import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePageDto, ContentFormat } from '../dto/create-page.dto';
import { ContentOperation, UpdatePageDto } from '../dto/update-page.dto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { InsertablePage, Page, User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  CursorPaginationResult,
  executeWithCursorPagination,
} from '@docmost/db/pagination/cursor-pagination';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { MovePageDto } from '../dto/move-page.dto';
import { generateSlugId } from '../../../common/helpers';
import { getPageTitle } from '../../../common/helpers';
import { executeTx } from '@docmost/db/utils';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { v7 as uuid7 } from 'uuid';
import {
  createYdocFromJson,
  getAttachmentIds,
  getProsemirrorContent,
  isAttachmentNode,
  removeMarkTypeFromDoc,
} from '../../../common/helpers/prosemirror/utils';
import {
  htmlToJson,
  jsonToNode,
  jsonToText,
} from 'src/collaboration/collaboration.util';
import {
  CopyPageMapEntry,
  ICopyPageAttachment,
} from '../dto/duplicate-page.dto';
import { Node as PMNode } from '@tiptap/pm/model';
import { StorageService } from '../../../integrations/storage/storage.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import { EventName } from '../../../common/events/event.contants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CollaborationGateway } from '../../../collaboration/collaboration.gateway';
import {
  INTERNAL_LINK_REGEX,
  extractPageSlugId,
} from '../../../integrations/export/utils';
import { markdownToHtml } from '@docmost/editor-ext';
import { WatcherService } from '../../watcher/watcher.service';
import { sql } from 'kysely';
import { TransclusionService } from '../transclusion/transclusion.service';
import { encryptionRootIdOf } from '../page-encryption.util';

@Injectable()
export class PageService {
  private readonly logger = new Logger(PageService.name);

  constructor(
    private pageRepo: PageRepo,
    private pagePermissionRepo: PagePermissionRepo,
    private attachmentRepo: AttachmentRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly storageService: StorageService,
    @InjectQueue(QueueName.ATTACHMENT_QUEUE) private attachmentQueue: Queue,
    @InjectQueue(QueueName.AI_QUEUE) private aiQueue: Queue,
    @InjectQueue(QueueName.GENERAL_QUEUE) private generalQueue: Queue,
    private eventEmitter: EventEmitter2,
    private collaborationGateway: CollaborationGateway,
    private readonly watcherService: WatcherService,
    private readonly transclusionService: TransclusionService,
  ) {}

  async findById(
    pageId: string,
    includeContent?: boolean,
    includeYdoc?: boolean,
    includeSpace?: boolean,
  ): Promise<Page> {
    return this.pageRepo.findById(pageId, {
      includeContent,
      includeYdoc,
      includeSpace,
    });
  }

  async create(
    userId: string,
    workspaceId: string,
    createPageDto: CreatePageDto,
    trx?: KyselyTransaction,
    isBase: boolean = false,
  ): Promise<Page> {
    // The parent is read FOR UPDATE below, so the insert must share that
    // transaction or the lock would be released before the row is written.
    // A caller-supplied transaction is reused as-is.
    const page = trx
      ? await this.createInTx(trx, userId, workspaceId, createPageDto, isBase)
      : await executeTx(this.db, (tx) =>
          this.createInTx(tx, userId, workspaceId, createPageDto, isBase),
        );

    if (trx) {
      // Add the watcher inside the caller's transaction so the async worker
      // never inserts against an uncommitted page (FK violation on bases).
      await this.watcherService.addPageWatchers(
        [userId],
        page.id,
        createPageDto.spaceId,
        workspaceId,
        trx,
      );
    } else {
      // queued only once the page is committed, so the worker can see it
      this.generalQueue
        .add(QueueJob.ADD_PAGE_WATCHERS, {
          userIds: [userId],
          pageId: page.id,
          spaceId: createPageDto.spaceId,
          workspaceId,
        })
        .catch((err) =>
          this.logger.warn(`Failed to queue add-page-watchers: ${err.message}`),
        );
    }

    return page;
  }

  private async createInTx(
    trx: KyselyTransaction,
    userId: string,
    workspaceId: string,
    createPageDto: CreatePageDto,
    isBase: boolean,
  ): Promise<Page> {
    let parentPageId = undefined;
    let parentPage: Page = undefined;

    // check if parent page exists
    if (createPageDto.parentPageId) {
      // Locked read: a conversion of this subtree locks the same rows, so
      // whichever runs first, the other sees a settled encryption state.
      // Without this a page could be inserted under a parent mid-conversion
      // and end up as plaintext inside an encrypted section.
      parentPage = (await this.pageRepo.findById(createPageDto.parentPageId, {
        trx,
        withLock: true,
      })) as Page;

      if (
        !parentPage ||
        parentPage.deletedAt ||
        parentPage.spaceId !== createPageDto.spaceId
      ) {
        throw new NotFoundException('Parent page not found');
      }

      parentPageId = parentPage.id;
    }

    // A page nested under an encrypted one joins that encrypted section: it
    // is born encrypted with the section's DEK, never written in plaintext.
    const encryptionRootId = parentPage ? encryptionRootIdOf(parentPage) : null;

    if (encryptionRootId) {
      // counted under the section root's lock, inside the same transaction as
      // the insert below, so concurrent creates cannot both fit into the last
      // remaining slot
      await this.pageRepo.assertSectionHasRoom(encryptionRootId, 1, trx);

      if (!createPageDto.encryptedBlob) {
        throw new BadRequestException(
          'A page inside an encrypted section must be created encrypted',
        );
      }
      if (createPageDto.content) {
        throw new BadRequestException(
          'Cannot create a plaintext page inside an encrypted section',
        );
      }
    } else if (createPageDto.encryptedBlob) {
      throw new BadRequestException(
        'Parent page is not part of an encrypted section',
      );
    }

    let content = undefined;
    let textContent = undefined;
    let ydoc = undefined;

    if (createPageDto?.content && createPageDto?.format) {
      const prosemirrorJson = await this.parseProsemirrorContent(
        createPageDto.content,
        createPageDto.format,
      );

      content = prosemirrorJson;
      textContent = jsonToText(prosemirrorJson);
      ydoc = createYdocFromJson(prosemirrorJson);
    }

    const page = await this.pageRepo.insertPage({
      slugId: generateSlugId(),
      title: createPageDto.title,
      position: await this.nextPagePosition(
        createPageDto.spaceId,
        parentPageId,
      ),
      icon: createPageDto.icon,
      parentPageId: parentPageId,
      spaceId: createPageDto.spaceId,
      creatorId: userId,
      workspaceId: workspaceId,
      lastUpdatedById: userId,
      isBase,
      content,
      textContent,
      ydoc,
      ...(encryptionRootId
        ? {
            isEncrypted: true,
            encryptionRootId,
            encryptedBlob: Buffer.from(createPageDto.encryptedBlob, 'base64'),
            encryptedVersion: '1',
          }
        : {}),
    }, trx);

    return page;
  }

  async nextPagePosition(spaceId: string, parentPageId?: string) {
    let pagePosition: string;

    const lastPageQuery = this.db
      .selectFrom('pages')
      .select(['position'])
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null)
      .orderBy('position', (ob) => ob.collate('C').desc())
      .limit(1);

    if (parentPageId) {
      // check for children of this page
      const lastPage = await lastPageQuery
        .where('parentPageId', '=', parentPageId)
        .executeTakeFirst();

      if (!lastPage) {
        pagePosition = generateJitteredKeyBetween(null, null);
      } else {
        // if there is an existing page, we should get a position below it
        pagePosition = generateJitteredKeyBetween(lastPage.position, null);
      }
    } else {
      // for root page
      const lastPage = await lastPageQuery
        .where('parentPageId', 'is', null)
        .executeTakeFirst();

      // if no existing page, make this the first
      if (!lastPage) {
        pagePosition = generateJitteredKeyBetween(null, null); // we expect "a0"
      } else {
        // if there is an existing page, we should get a position below it
        pagePosition = generateJitteredKeyBetween(lastPage.position, null);
      }
    }

    return pagePosition;
  }

  async update(
    page: Page,
    updatePageDto: UpdatePageDto,
    user: User,
  ): Promise<Page> {
    const contributors = new Set<string>(page.contributorIds);
    contributors.add(user.id);
    const contributorIds = Array.from(contributors);

    await this.pageRepo.updatePage(
      {
        title: updatePageDto.title,
        icon: updatePageDto.icon,
        lastUpdatedById: user.id,
        updatedAt: new Date(),
        contributorIds: contributorIds,
      },
      page.id,
    );

    this.generalQueue
      .add(QueueJob.ADD_PAGE_WATCHERS, {
        userIds: [user.id],
        pageId: page.id,
        spaceId: page.spaceId,
        workspaceId: page.workspaceId,
      })
      .catch((err) =>
        this.logger.warn(`Failed to queue add-page-watchers: ${err.message}`),
      );

    if (
      updatePageDto.content &&
      updatePageDto.operation &&
      updatePageDto.format
    ) {
      if (page.isEncrypted) {
        throw new BadRequestException(
          'Cannot update content of an encrypted page server-side',
        );
      }
      await this.updatePageContent(
        page.id,
        updatePageDto.content,
        updatePageDto.operation,
        updatePageDto.format,
        user,
      );
    }

    return await this.pageRepo.findById(page.id, {
      includeSpace: true,
      includeContent: true,
      includeCreator: true,
      includeLastUpdatedBy: true,
      includeContributors: true,
    });
  }

  async updatePageContent(
    pageId: string,
    content: string | object,
    operation: ContentOperation,
    format: ContentFormat,
    user: User,
  ): Promise<void> {
    const prosemirrorJson = await this.parseProsemirrorContent(content, format);

    const documentName = `page.${pageId}`;
    await this.collaborationGateway.handleYjsEvent(
      'updatePageContent',
      documentName,
      { operation, prosemirrorJson, user },
    );
  }

  async getSidebarPages(
    spaceId: string,
    pagination: PaginationOptions,
    pageId?: string,
    userId?: string,
    spaceCanEdit?: boolean,
  ): Promise<CursorPaginationResult<Partial<Page> & { hasChildren: boolean }>> {
    let query = this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'position',
        'parentPageId',
        'spaceId',
        'creatorId',
        'isBase',
        'isEncrypted',
        // the sidebar builds the tree, and the client's key vault is keyed by
        // section: without this every nested encrypted page looks self-rooted
        'encryptionRootId',
        'deletedAt',
      ])
      .select((eb) => this.pageRepo.withHasChildren(eb))
      .where('deletedAt', 'is', null)
      .where('spaceId', '=', spaceId);

    if (pageId) {
      query = query.where('parentPageId', '=', pageId);
    } else {
      query = query.where('parentPageId', 'is', null);
    }

    const result = await executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        {
          expression: 'position',
          direction: 'asc',
          orderModifier: (ob) => ob.collate('C').asc(),
          cursorExpression: sql`position collate "C"`,
        },
        { expression: 'id', direction: 'asc' },
      ],
      parseCursor: (cursor) => ({
        position: cursor.position,
        id: cursor.id,
      }),
    });

    if (userId && result.items.length > 0) {
      const hasRestrictions =
        await this.pagePermissionRepo.hasRestrictedPagesInSpace(spaceId);

      if (!hasRestrictions) {
        result.items = result.items.map((p: any) => ({
          ...p,
          canEdit: spaceCanEdit ?? true,
        }));
      } else {
        const pageIds = result.items.map((p: any) => p.id);

        const accessiblePages =
          await this.pagePermissionRepo.filterAccessiblePageIdsWithPermissions(
            pageIds,
            userId,
          );

        const permissionMap = new Map(
          accessiblePages.map((p) => [p.id, p.canEdit]),
        );

        result.items = result.items
          .filter((p: any) => permissionMap.has(p.id))
          .map((p: any) => ({
            ...p,
            canEdit: permissionMap.get(p.id) && (spaceCanEdit ?? true),
          }));

        const pagesWithChildren = result.items.filter(
          (p: any) => p.hasChildren,
        );
        if (pagesWithChildren.length > 0) {
          const parentIds = pagesWithChildren.map((p: any) => p.id);
          const parentsWithAccessibleChildren =
            await this.pagePermissionRepo.getParentIdsWithAccessibleChildren(
              parentIds,
              userId,
            );
          const hasAccessibleChildrenSet = new Set(
            parentsWithAccessibleChildren,
          );

          result.items = result.items.map((p: any) => ({
            ...p,
            hasChildren: p.hasChildren && hasAccessibleChildrenSet.has(p.id),
          }));
        }
      }
    }

    return result;
  }

  async movePageToSpace(rootPage: Page, spaceId: string, userId: string) {
    let childPageIds: string[] = [];
    let sectionPageIds: string[] = [];

    // moving to another space always lands at the space root, so this is the
    // same question movePage asks with a null parent: a keyed descendant may
    // not leave, an encryption root may move and take its subtree along
    this.assertEncryptionMoveAllowed(rootPage, null);

    const allPages = await this.pageRepo.getPageAndDescendants(rootPage.id, {
      includeContent: false,
    });

    // Filter to only accessible pages while maintaining tree integrity
    const accessiblePages = await this.filterAccessibleTreePages(
      allPages,
      rootPage.id,
      userId,
      rootPage.spaceId,
    );
    const accessibleIds = new Set(accessiblePages.map((p) => p.id));

    // Find inaccessible pages whose parent is being moved - these need to be orphaned
    const pagesToOrphan = allPages.filter(
      (p) =>
        !accessibleIds.has(p.id) &&
        p.parentPageId &&
        accessibleIds.has(p.parentPageId),
    );

    // A keyed page's root is an ancestor inside the moved subtree (sections
    // are contiguous), so orphaning it would leave it keyed to a root in
    // another space. Checked on the orphans themselves rather than on
    // rootPage: the section root may sit anywhere in the subtree, not just
    // at the page being moved.
    if (pagesToOrphan.some((p) => p.encryptionRootId)) {
      throw new BadRequestException({
        code: 'ENCRYPTED_SECTION_PARTIAL_MOVE',
        message:
          'This encrypted section contains pages you cannot access, so it cannot be moved to another space.',
      });
    }

    await executeTx(this.db, async (trx) => {
      // Everything above ran on an unlocked snapshot. Encryption conversions
      // lock the rows they convert (lockAndVerifySection), so locking the
      // moved subtree here and re-checking makes the two serialize instead of
      // interleaving — without this, a concurrent join-convert could key a
      // page in this subtree to a root that stays behind in the old space.
      const snapshotIds = allPages.map((p) => p.id);
      const lockedRows = (await trx
        .selectFrom('pages')
        .select(['id', 'deletedAt', 'isEncrypted', 'encryptionRootId'])
        .where('id', 'in', snapshotIds)
        // same fixed order as movePage/lockAndVerifySection, so overlapping
        // transactions queue instead of deadlocking
        .orderBy('id')
        .forUpdate()
        .execute()) as Page[];

      const lockedRoot = lockedRows.find((p) => p.id === rootPage.id);
      if (!lockedRoot || lockedRoot.deletedAt) {
        throw new NotFoundException('Page not found');
      }
      this.assertEncryptionMoveAllowed(lockedRoot, null);

      // the subtree itself must not have changed shape: a page moved in after
      // the snapshot would be silently left out of the space move, one moved
      // out would be dragged along, and an internal reparent — same members,
      // different links — would invalidate the orphan and access pruning
      // computed from the snapshot above, so parent links are compared too
      const actualRows = await this.liveSubtreeInTx(trx, rootPage.id);
      const snapshotIdSet = new Set(snapshotIds);
      const snapshotParentById = new Map(
        allPages.map((p) => [p.id, p.parentPageId ?? null]),
      );
      if (
        actualRows.length !== snapshotIds.length ||
        actualRows.some(
          (row) =>
            !snapshotParentById.has(row.id) ||
            snapshotParentById.get(row.id) !== (row.parentPageId ?? null),
        )
      ) {
        throw new ConflictException(
          'The page tree changed while it was being moved. Please try again.',
        );
      }

      // orphan encryption state was also read pre-lock — re-check it on the
      // locked rows so a just-keyed orphan cannot be severed from its root
      const lockedById = new Map(lockedRows.map((p) => [p.id, p]));
      if (
        pagesToOrphan.some((p) => lockedById.get(p.id)?.encryptionRootId)
      ) {
        throw new BadRequestException({
          code: 'ENCRYPTED_SECTION_PARTIAL_MOVE',
          message:
            'This encrypted section contains pages you cannot access, so it cannot be moved to another space.',
        });
      }

      // No moving page may be keyed to a root that stays behind. Section
      // contiguity plus the checks above should make this unreachable, but a
      // violation would strand ciphertext without a reachable key, so verify
      // on the locked rows rather than trust the invariant.
      if (
        lockedRows.some(
          (p) =>
            accessibleIds.has(p.id) &&
            p.encryptionRootId &&
            !snapshotIdSet.has(p.encryptionRootId),
        )
      ) {
        throw new ConflictException(
          'The page tree changed while it was being moved. Please try again.',
        );
      }

      // Orphan inaccessible child pages (make them root pages in original space)
      for (const page of pagesToOrphan) {
        const orphanPosition = await this.nextPagePosition(
          rootPage.spaceId,
          null,
        );
        await this.pageRepo.updatePage(
          { parentPageId: null, position: orphanPosition },
          page.id,
          trx,
        );
      }

      // Update root page
      const nextPosition = await this.nextPagePosition(spaceId);
      await this.pageRepo.updatePage(
        { spaceId, parentPageId: null, position: nextPosition },
        rootPage.id,
        trx,
      );

      const pageIdsToMove = accessiblePages.map((p) => p.id);

      childPageIds = pageIdsToMove.filter((id) => id !== rootPage.id);

      if (pageIdsToMove.length > 1) {
        // Update sub pages (all accessible pages except root)
        await this.pageRepo.updatePages({ spaceId }, childPageIds, trx);
      }

      // The accessible-subtree walk above skips trashed pages, but a trashed
      // page keyed to an encryption root in this subtree is still part of the
      // section and is still decrypted with it. It moves with the section
      // (matched on the key pointer, which trash does not affect), and its
      // related rows have to follow too or a later restore lands with
      // attachments, access and watchers still pointing at the old space.
      // Roots are collected from the moved pages, not just rootPage: a
      // plaintext page can carry nested encrypted sections in its subtree.
      // Read from the locked rows, not the pre-lock snapshot — a convert that
      // committed in the snapshot→lock window can have minted a root whose
      // trashed keyed pages only the locked state knows about.
      sectionPageIds = pageIdsToMove;
      const movedEncryptionRootIds = lockedRows
        .filter(
          (p) =>
            accessibleIds.has(p.id) && p.isEncrypted && !p.encryptionRootId,
        )
        .map((p) => p.id);
      if (movedEncryptionRootIds.length > 0) {
        const keyed = await trx
          .selectFrom('pages')
          .select('id')
          .where('encryptionRootId', 'in', movedEncryptionRootIds)
          .execute();

        await trx
          .updateTable('pages')
          .set({ spaceId })
          .where('encryptionRootId', 'in', movedEncryptionRootIds)
          .execute();

        const alreadyMoving = new Set(pageIdsToMove);
        sectionPageIds = [
          ...pageIdsToMove,
          ...keyed.map((p) => p.id).filter((id) => !alreadyMoving.has(id)),
        ];
      }

      if (sectionPageIds.length > 0) {
        await trx
          .updateTable('pageAccess')
          .set({ spaceId: spaceId })
          .where('pageId', 'in', sectionPageIds)
          .execute();

        // update spaceId in shares
        await trx
          .updateTable('shares')
          .set({ spaceId: spaceId })
          .where('pageId', 'in', sectionPageIds)
          .execute();

        // Update comments
        await trx
          .updateTable('comments')
          .set({ spaceId: spaceId })
          .where('pageId', 'in', sectionPageIds)
          .execute();

        // Update page verifications
        await trx
          .updateTable('pageVerifications')
          .set({ spaceId: spaceId })
          .where('pageId', 'in', sectionPageIds)
          .execute();

        // Update notifications — access follows the page after a move
        await trx
          .updateTable('notifications')
          .set({ spaceId: spaceId })
          .where('pageId', 'in', sectionPageIds)
          .execute();

        // Update attachments
        await this.attachmentRepo.updateAttachmentsByPageId(
          { spaceId },
          sectionPageIds,
          trx,
        );

        // Update watchers and remove those without access to new space
        await this.watcherService.movePageWatchersToSpace(
          sectionPageIds,
          spaceId,
          {
            trx,
          },
        );

      }
    });

    if (sectionPageIds.length > 0) {
      await this.aiQueue.add(
        QueueJob.PAGE_MOVED_TO_SPACE,
        {
          pageIds: sectionPageIds,
          spaceId,
          workspaceId: rootPage.workspaceId,
        },
        {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 2 * 60 * 1000,
          },
        },
      );

      // The pages now answer to a different space's membership. Anything
      // holding a session authorized against the old one — notably the
      // encrypted relay — has to re-authorize. Emitted only after the
      // transaction commits, so a relay rejoin re-authorizes against the new
      // space rather than the uncommitted row; sectionPageIds rather than
      // pageIdsToMove, so pointer-moved trashed pages get their rooms closed
      // too.
      this.eventEmitter.emit(EventName.PAGE_MOVED_TO_SPACE, {
        pageIds: sectionPageIds,
        workspaceId: rootPage.workspaceId,
      });
    }

    return { childPageIds };
  }

  async duplicatePage(
    rootPage: Page,
    targetSpaceId: string | undefined,
    authUser: User,
  ) {
    const spaceId = targetSpaceId || rootPage.spaceId;
    const isDuplicateInSameSpace =
      !targetSpaceId || targetSpaceId === rootPage.spaceId;

    if (rootPage.encryptionRootId && !isDuplicateInSameSpace) {
      // the copy would land outside the section, keyed to a root it can no
      // longer be reached from
      throw new BadRequestException({
        code: 'ENCRYPTED_PAGE_MOVE_OUT',
        encryptionRootId: rootPage.encryptionRootId,
        message:
          'A page inside an encrypted section cannot be copied to another space.',
      });
    }

    let nextPosition: string;

    if (isDuplicateInSameSpace) {
      // For duplicate in same space, position right after the original page
      nextPosition = generateJitteredKeyBetween(rootPage.position, null);
    } else {
      // For copy to different space, position at the end
      nextPosition = await this.nextPagePosition(spaceId);
    }

    const allPages = await this.pageRepo.getPageAndDescendants(rootPage.id, {
      includeContent: true,
      includeEncryption: true,
    });

    // Filter to only accessible pages while maintaining tree integrity
    const pages = await this.filterAccessibleTreePages(
      allPages,
      rootPage.id,
      authUser.id,
      rootPage.spaceId,
    );

    const pageMap = new Map<string, CopyPageMapEntry>();
    pages.forEach((page) => {
      pageMap.set(page.id, {
        newPageId: uuid7(),
        newSlugId: generateSlugId(),
        oldSlugId: page.slugId,
      });
    });

    const slugIdMap = new Map<string, CopyPageMapEntry>();
    for (const [, entry] of pageMap) {
      slugIdMap.set(entry.oldSlugId, entry);
    }

    const attachmentMap = new Map<string, ICopyPageAttachment>();

    const insertablePages: InsertablePage[] = await Promise.all(
      pages.map(async (page) => {
        const pageFromMap = pageMap.get(page.id);

        // Add "Copy of " prefix to the root page title only for duplicates in same space
        let title = page.title;
        if (isDuplicateInSameSpace && page.id === rootPage.id) {
          const originalTitle = getPageTitle(page.title);
          title = `Copy of ${originalTitle}`;
        }

        const basePage = {
          id: pageFromMap.newPageId,
          slugId: pageFromMap.newSlugId,
          title: title,
          icon: page.icon,
          position: page.id === rootPage.id ? nextPosition : page.position,
          spaceId: spaceId,
          workspaceId: page.workspaceId,
          creatorId: authUser.id,
          lastUpdatedById: authUser.id,
          parentPageId:
            page.id === rootPage.id
              ? isDuplicateInSameSpace
                ? rootPage.parentPageId
                : null
              : page.parentPageId
                ? pageMap.get(page.parentPageId)?.newPageId
                : null,
        };

        if (page.isEncrypted) {
          // Encrypted pages are duplicated as opaque ciphertext: the same
          // wrapped DEK unlocks the copy, and the server never sees
          // plaintext. Known limitations (contents are opaque, so they
          // cannot be rewritten): attachment ids, mentions and internal
          // links inside the ciphertext keep pointing at the original
          // pages/attachments.
          //
          // Key pointers are rewritten to stay inside the copy: pages keyed
          // to a root that was itself copied follow the copied root. A page
          // keyed to a root outside the copy (duplicating a single page of a
          // section) keeps pointing at the original root — same section,
          // same key.
          return {
            ...basePage,
            isEncrypted: true,
            encryptionMeta: page.encryptionMeta,
            // the copy opens with the same password, so it keeps the same
            // person as the one who may change or remove its encryption
            encryptedById: page.encryptedById,
            encryptionRootId: page.encryptionRootId
              ? (pageMap.get(page.encryptionRootId)?.newPageId ??
                page.encryptionRootId)
              : null,
            encryptedBlob: page.encryptedBlob,
            encryptedVersion: page.encryptedVersion,
            content: null,
            textContent: null,
            ydoc: null,
          };
        }

        const pageContent = getProsemirrorContent(page.content);

        const doc = jsonToNode(pageContent);
        const prosemirrorDoc = removeMarkTypeFromDoc(doc, 'comment');

        const attachmentIds = getAttachmentIds(prosemirrorDoc.toJSON());

        if (attachmentIds.length > 0) {
          attachmentIds.forEach((attachmentId: string) => {
            const newPageId = pageFromMap.newPageId;
            const newAttachmentId = uuid7();
            attachmentMap.set(attachmentId, {
              newPageId: newPageId,
              oldPageId: page.id,
              oldAttachmentId: attachmentId,
              newAttachmentId: newAttachmentId,
            });

            prosemirrorDoc.descendants((node: PMNode) => {
              if (isAttachmentNode(node.type.name)) {
                if (node.attrs.attachmentId === attachmentId) {
                  //@ts-ignore
                  node.attrs.attachmentId = newAttachmentId;

                  if (node.attrs.src) {
                    //@ts-ignore
                    node.attrs.src = node.attrs.src.replace(
                      attachmentId,
                      newAttachmentId,
                    );
                  }
                  if (node.attrs.src) {
                    //@ts-ignore
                    node.attrs.src = node.attrs.src.replace(
                      attachmentId,
                      newAttachmentId,
                    );
                  }
                }
              }
            });
          });
        }

        // Update internal page links in mention nodes
        prosemirrorDoc.descendants((node: PMNode) => {
          if (
            node.type.name === 'mention' &&
            node.attrs.entityType === 'page'
          ) {
            const referencedPageId = node.attrs.entityId;

            // Check if the referenced page is within the pages being copied
            if (referencedPageId && pageMap.has(referencedPageId)) {
              const mappedPage = pageMap.get(referencedPageId);
              //@ts-ignore
              node.attrs.entityId = mappedPage.newPageId;
              //@ts-ignore
              node.attrs.slugId = mappedPage.newSlugId;
            }
          }

          // Remap transclusion-reference source pages to their copies when
          // the source page is also being duplicated in the same operation.
          if (node.type.name === 'transclusionReference') {
            const sourcePageId = node.attrs.sourcePageId;
            if (sourcePageId && pageMap.has(sourcePageId)) {
              const mappedPage = pageMap.get(sourcePageId);
              //@ts-ignore
              node.attrs.sourcePageId = mappedPage.newPageId;
            }
          }

          // Update internal page links in link marks
          for (const mark of node.marks) {
            if (
              mark.type.name === 'link' &&
              mark.attrs.internal &&
              mark.attrs.href
            ) {
              const match = mark.attrs.href.match(INTERNAL_LINK_REGEX);
              if (match) {
                const slugId = extractPageSlugId(match[5]);
                if (slugId && slugIdMap.has(slugId)) {
                  const mappedPage = slugIdMap.get(slugId);
                  //@ts-ignore
                  mark.attrs.href = mark.attrs.href.replace(
                    slugId,
                    mappedPage.newSlugId,
                  );
                }
              }
            }
          }
        });

        const prosemirrorJson = prosemirrorDoc.toJSON();

        return {
          ...basePage,
          content: prosemirrorJson,
          textContent: jsonToText(prosemirrorJson),
          ydoc: createYdocFromJson(prosemirrorJson),
        };
      }),
    );

    if (rootPage.encryptionRootId) {
      // The copies stay keyed to the section they came from — only duplicating
      // a section *root* produces a new section — so this grows that section by
      // the size of the subtree. Checked and inserted under the root's lock so
      // it cannot race another growth path into exceeding the cap.
      await executeTx(this.db, async (trx) => {
        await this.pageRepo.assertSectionHasRoom(
          rootPage.encryptionRootId,
          insertablePages.length,
          trx,
        );
        await trx.insertInto('pages').values(insertablePages).execute();
      });
    } else {
      await this.db.insertInto('pages').values(insertablePages).execute();
    }

    // Extract transclusions from every duplicated page and persist them in
    // one statement. Duplication bypasses Yjs onStoreDocument; brand-new
    // pages never have prior rows so we can skip the diff and just bulk-insert.
    // Encrypted copies carry no plaintext content and are skipped.
    const plaintextPages = insertablePages
      .filter((p) => p.content)
      .map((p) => ({
        id: p.id,
        workspaceId: p.workspaceId,
        content: p.content,
      }));

    try {
      await this.transclusionService.insertTransclusionsForPages(
        plaintextPages,
      );
    } catch (err) {
      this.logger.error(
        'Failed to insert transclusions for duplicated pages',
        err,
      );
    }

    try {
      await this.transclusionService.insertReferencesForPages(plaintextPages);
    } catch (err) {
      this.logger.error(
        'Failed to insert transclusion references for duplicated pages',
        err,
      );
    }

    const insertedPageIds = insertablePages.map((page) => page.id);
    this.eventEmitter.emit(EventName.PAGE_CREATED, {
      pageIds: insertedPageIds,
      workspaceId: authUser.workspaceId,
    });

    //TODO: best to handle this in a queue
    const attachmentsIds = Array.from(attachmentMap.keys());
    if (attachmentsIds.length > 0) {
      const attachments = await this.db
        .selectFrom('attachments')
        .selectAll()
        .where('id', 'in', attachmentsIds)
        .where('workspaceId', '=', rootPage.workspaceId)
        .execute();

      for (const attachment of attachments) {
        try {
          const pageAttachment = attachmentMap.get(attachment.id);

          // make sure the copied attachment belongs to the page it was copied from
          if (attachment.pageId !== pageAttachment.oldPageId) {
            continue;
          }

          const newAttachmentId = pageAttachment.newAttachmentId;

          const newPageId = pageAttachment.newPageId;

          const newPathFile = attachment.filePath.replace(
            attachment.id,
            newAttachmentId,
          );

          try {
            await this.storageService.copy(attachment.filePath, newPathFile);

            await this.db
              .insertInto('attachments')
              .values({
                id: newAttachmentId,
                type: attachment.type,
                filePath: newPathFile,
                fileName: attachment.fileName,
                fileSize: attachment.fileSize,
                mimeType: attachment.mimeType,
                fileExt: attachment.fileExt,
                creatorId: attachment.creatorId,
                workspaceId: attachment.workspaceId,
                pageId: newPageId,
                spaceId: spaceId,
              })
              .execute();
          } catch (err) {
            this.logger.error(
              `Duplicate page: failed to copy attachment ${attachment.id}`,
              err,
            );
            // Continue with other attachments even if one fails
          }
        } catch (err) {
          this.logger.error(err);
        }
      }
    }

    const newPageId = pageMap.get(rootPage.id).newPageId;
    const duplicatedPage = await this.pageRepo.findById(newPageId, {
      includeSpace: true,
    });

    const hasChildren = pages.length > 1;
    const childPageIds = insertedPageIds.filter((id) => id !== newPageId);

    return {
      ...duplicatedPage,
      hasChildren,
      childPageIds,
    };
  }

  /**
   * A page and its non-trashed descendants with their parent links, read
   * inside a transaction — the same population getPageAndDescendants returns,
   * so the two can be compared (membership and structure) after row locks.
   */
  private async liveSubtreeInTx(
    trx: KyselyTransaction,
    pageId: string,
  ): Promise<{ id: string; parentPageId: string | null }[]> {
    return (await trx
      .withRecursive('subtree', (db) =>
        db
          .selectFrom('pages')
          .select(['id', 'parentPageId'])
          .where('id', '=', pageId)
          .where('deletedAt', 'is', null)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select(['p.id', 'p.parentPageId'])
              .innerJoin('subtree as s', 'p.parentPageId', 's.id')
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('subtree')
      .selectAll()
      .execute()) as { id: string; parentPageId: string | null }[];
  }

  /**
   * A move must never change which key a page is encrypted with, because the
   * server cannot re-encrypt anything. Everything that would require a rekey
   * is rejected with a code the client turns into the right prompt.
   *
   * Allowed: moves that keep the page in the same encrypted section (or keep
   * it plaintext), and relocating a whole encrypted section — its descendants
   * follow through parentPageId without being touched.
   */
  private assertEncryptionMoveAllowed(movedPage: Page, parentPage: Page | null) {
    const sourceRootId = encryptionRootIdOf(movedPage);
    const targetRootId = parentPage ? encryptionRootIdOf(parentPage) : null;

    if (sourceRootId === targetRootId) return;

    if (!sourceRootId) {
      // plaintext page dropped into an encrypted section: the client must
      // encrypt it with that section's key before the move can happen
      throw new BadRequestException({
        code: 'ENCRYPTION_REQUIRED',
        encryptionRootId: targetRootId,
        message:
          'Encrypt this page with the section key before moving it there.',
      });
    }

    if (movedPage.encryptionRootId) {
      // a keyed descendant cannot leave: outside its section the wrapped DEK
      // it depends on is no longer reachable
      throw new BadRequestException({
        code: 'ENCRYPTED_PAGE_MOVE_OUT',
        encryptionRootId: sourceRootId,
        message:
          'Decrypt this page before moving it out of its encrypted section.',
      });
    }

    if (targetRootId) {
      // an encryption root moving into another section would need its whole
      // subtree re-encrypted under the target's key
      throw new BadRequestException({
        code: 'ENCRYPTED_SECTION_NESTING',
        message: 'An encrypted section cannot be nested inside another one.',
      });
    }

    // an encryption root moving somewhere plaintext keeps its own key and
    // takes its subtree with it — nothing to re-encrypt
  }

  async movePage(dto: MovePageDto, movedPage: Page) {
    // validate position value by attempting to generate a key
    try {
      generateJitteredKeyBetween(dto.position, null);
    } catch (err) {
      throw new BadRequestException('Invalid move position');
    }

    if (dto.parentPageId && dto.parentPageId === dto.pageId) {
      throw new BadRequestException('A page cannot be its own parent');
    }

    // dto ids may be slugIds; resolve to UUIDs before the locked query below,
    // which matches on `id` only. The slugId->id mapping is immutable, so an
    // unlocked resolve cannot go stale.
    let targetParentId: string | null = null;
    if (dto.parentPageId) {
      const targetParent = await this.pageRepo.findById(dto.parentPageId);
      if (!targetParent || targetParent.deletedAt) {
        throw new NotFoundException('Parent page not found');
      }
      targetParentId = targetParent.id;
    }

    if (movedPage.parentPageId === targetParentId) {
      // position-only move: encryption state cannot change, no locking needed
      await this.pageRepo.updatePage(
        { position: dto.position, parentPageId: undefined },
        movedPage.id,
      );
      return;
    }

    await executeTx(this.db, async (trx) => {
      // Lock the moved page and its new parent, and re-read their encryption
      // state under the lock: a conversion of either subtree locks the same
      // rows, so the move cannot slip in against a stale snapshot and land a
      // page in a section whose key it does not have.
      // Both rows in one statement, ordered by id: taking them one at a time
      // lets this transaction hold the moved page while another holds the
      // parent and wants the moved page, which Postgres can only resolve by
      // aborting one of them. A fixed order means every caller queues instead.
      const idsToLock = targetParentId
        ? [movedPage.id, targetParentId]
        : [movedPage.id];

      const lockedRows = (await trx
        .selectFrom('pages')
        .selectAll()
        .where('id', 'in', idsToLock)
        .orderBy('id')
        .forUpdate()
        .execute()) as Page[];

      const lockedMovedPage = lockedRows.find((p) => p.id === movedPage.id);

      if (!lockedMovedPage || lockedMovedPage.deletedAt) {
        throw new NotFoundException('Page not found');
      }

      let parentPage: Page = null;
      let parentPageId: string = null;
      if (targetParentId) {
        parentPage = lockedRows.find((p) => p.id === targetParentId);

        if (
          !parentPage ||
          parentPage.deletedAt ||
          parentPage.spaceId !== lockedMovedPage.spaceId
        ) {
          throw new NotFoundException('Parent page not found');
        }
        parentPageId = parentPage.id;
      }

      this.assertEncryptionMoveAllowed(lockedMovedPage, parentPage);

      await this.pageRepo.updatePage(
        { position: dto.position, parentPageId },
        movedPage.id,
        trx,
      );
    });
  }

  async getPageBreadCrumbs(childPageId: string) {
    const ancestors = await this.db
      .withRecursive('page_ancestors', (db) =>
        db
          .selectFrom('pages')
          .select([
            'id',
            'slugId',
            'title',
            'icon',
            'isBase',
            'isEncrypted',
            'encryptionRootId',
            'position',
            'parentPageId',
            'spaceId',
            'deletedAt',
          ])
          .where('id', '=', childPageId)
          .where('deletedAt', 'is', null)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select([
                'p.id',
                'p.slugId',
                'p.title',
                'p.icon',
                'p.isBase',
                'p.isEncrypted',
                'p.encryptionRootId',
                'p.position',
                'p.parentPageId',
                'p.spaceId',
                'p.deletedAt',
              ])
              .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id')
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('page_ancestors')
      .selectAll('page_ancestors')
      .select((eb) =>
        eb
          .exists(
            eb
              .selectFrom('pages as child')
              .select(sql`1`.as('one'))
              .whereRef('child.parentPageId', '=', 'page_ancestors.id')
              .where('child.deletedAt', 'is', null),
          )
          .as('hasChildren'),
      )
      .execute();

    return ancestors.reverse();
  }

  async getRecentSpacePages(
    spaceId: string,
    userId: string,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<Page>> {
    const result = await this.pageRepo.getRecentPagesInSpace(
      spaceId,
      pagination,
    );

    if (result.items.length > 0) {
      const pageIds = result.items.map((p) => p.id);
      const accessibleIds =
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds,
          userId,
          spaceId,
        });
      const accessibleSet = new Set(accessibleIds);
      result.items = result.items.filter((p) => accessibleSet.has(p.id));
    }

    return result;
  }

  async getRecentPages(
    userId: string,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<Page>> {
    const result = await this.pageRepo.getRecentPages(userId, pagination);

    if (result.items.length > 0) {
      const pageIds = result.items.map((p) => p.id);
      const accessibleIds =
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds,
          userId,
        });
      const accessibleSet = new Set(accessibleIds);
      result.items = result.items.filter((p) => accessibleSet.has(p.id));
    }

    return result;
  }

  async getCreatedByPages(
    creatorId: string,
    requestingUserId: string,
    pagination: PaginationOptions,
    spaceId?: string,
  ): Promise<CursorPaginationResult<Page>> {
    const result = await this.pageRepo.getCreatedByPages(
      creatorId,
      requestingUserId,
      pagination,
      spaceId,
    );

    if (result.items.length > 0) {
      const pageIds = result.items.map((p) => p.id);
      const accessibleIds =
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds,
          userId: requestingUserId,
        });
      const accessibleSet = new Set(accessibleIds);
      result.items = result.items.filter((p) => accessibleSet.has(p.id));
    }

    return result;
  }

  async getDeletedSpacePages(
    spaceId: string,
    userId: string,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<Page>> {
    const result = await this.pageRepo.getDeletedPagesInSpace(
      spaceId,
      pagination,
    );

    if (result.items.length > 0) {
      const pageIds = result.items.map((p) => p.id);
      const accessibleIds =
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds,
          userId,
          spaceId,
        });
      const accessibleSet = new Set(accessibleIds);
      result.items = result.items.filter((p) => accessibleSet.has(p.id));
    }

    return result;
  }

  async forceDelete(pageId: string, workspaceId: string): Promise<void> {
    // Get all descendant IDs (including the page itself) using recursive CTE
    const descendants = await this.db
      .withRecursive('page_descendants', (db) =>
        db
          .selectFrom('pages')
          .select(['id'])
          .where('id', '=', pageId)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select(['p.id'])
              .innerJoin('page_descendants as pd', 'pd.id', 'p.parentPageId'),
          ),
      )
      .selectFrom('page_descendants')
      .selectAll()
      .execute();

    const pageIds = descendants.map((d) => d.id);

    // Queue attachment deletion for all pages with unique job IDs to prevent duplicates
    for (const id of pageIds) {
      await this.attachmentQueue.add(
        QueueJob.DELETE_PAGE_ATTACHMENTS,
        {
          pageId: id,
        },
        {
          jobId: `delete-page-attachments-${id}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    }

    if (pageIds.length > 0) {
      await this.db.deleteFrom('pages').where('id', 'in', pageIds).execute();
      this.eventEmitter.emit(EventName.PAGE_DELETED, {
        pageIds: pageIds,
        workspaceId,
      });
    }
  }

  async removePage(
    pageId: string,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.pageRepo.removePage(pageId, userId, workspaceId);
  }

  private async parseProsemirrorContent(
    content: string | object,
    format: ContentFormat,
  ): Promise<any> {
    let prosemirrorJson: any;

    switch (format) {
      case 'markdown': {
        const html = await markdownToHtml(content as string);
        prosemirrorJson = htmlToJson(html as string);
        break;
      }
      case 'html': {
        prosemirrorJson = htmlToJson(content as string);
        break;
      }
      case 'json':
      default: {
        prosemirrorJson = content;
        break;
      }
    }

    try {
      jsonToNode(prosemirrorJson);
    } catch (err) {
      throw new BadRequestException('Invalid content format');
    }

    return prosemirrorJson;
  }

  /**
   * Filters a list of pages to only those accessible to the user while maintaining tree integrity.
   * A page is included only if:
   * 1. The user has access to it
   * 2. Its parent is also included (or it's the root page)
   * This ensures that if a middle page is inaccessible, its entire subtree is excluded.
   */
  private async filterAccessibleTreePages<
    T extends { id: string; parentPageId: string | null },
  >(
    pages: T[],
    rootPageId: string,
    userId: string,
    spaceId?: string,
  ): Promise<T[]> {
    if (pages.length === 0) return [];

    const pageIds = pages.map((p) => p.id);
    const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds(
      {
        pageIds,
        userId,
        spaceId,
      },
    );
    const accessibleSet = new Set(accessibleIds);

    // Prune: include a page only if it's accessible AND its parent chain to root is included
    const includedIds = new Set<string>();

    // Process pages in a way that ensures parents are processed before children
    // We do this by iterating until no more pages can be added
    let changed = true;
    while (changed) {
      changed = false;
      for (const page of pages) {
        if (includedIds.has(page.id)) continue;
        if (!accessibleSet.has(page.id)) continue;

        // Root page: include if accessible
        if (page.id === rootPageId) {
          includedIds.add(page.id);
          changed = true;
          continue;
        }

        // Non-root: include if parent is already included
        if (page.parentPageId && includedIds.has(page.parentPageId)) {
          includedIds.add(page.id);
          changed = true;
        }
      }
    }

    return pages.filter((p) => includedIds.has(p.id));
  }
}
