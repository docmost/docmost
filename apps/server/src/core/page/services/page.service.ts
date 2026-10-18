import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { dbOrTx, executeTx } from '@docmost/db/utils';
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
import { LabelRepo } from '@docmost/db/repos/label/label.repo';
import { WsService } from '../../../ws/ws.service';
import { CollabAccessService } from '../../../collaboration/services/collab-access.service';
import { PageApprovalService } from '../approval/page-approval.service';
import { PageApprovalPublishService } from '../approval/page-approval-publish.service';
import { PageDraftRepo } from '@docmost/db/repos/page/page-draft.repo';
import {
  MOVE_OUT_OF_APPROVAL_MESSAGE,
  PAGE_LOCKED_MESSAGE,
  TRASH_APPROVED_PAGE_MESSAGE,
  planSpaceMove,
  toDraftTitleIcon,
} from '../approval/page-approval.utils';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';

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
    private readonly labelRepo: LabelRepo,
    private readonly wsService: WsService,
    private readonly collabAccessService: CollabAccessService,
    private readonly pageApprovalService: PageApprovalService,
    private readonly pageDraftRepo: PageDraftRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageApprovalPublishService: PageApprovalPublishService,
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
    let parentPageId = undefined;

    // check if parent page exists
    if (createPageDto.parentPageId) {
      const parentPage = await this.pageRepo.findById(
        createPageDto.parentPageId,
      );

      if (
        !parentPage ||
        parentPage.deletedAt ||
        parentPage.spaceId !== createPageDto.spaceId
      ) {
        throw new NotFoundException('Parent page not found');
      }

      parentPageId = parentPage.id;
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

    const position = await this.nextPagePosition(
      createPageDto.spaceId,
      parentPageId,
    );

    // Divert in the insert transaction so draft content never commits to pages.
    const page = await executeTx(
      this.db,
      async (tx) => {
        const inserted = await this.pageRepo.insertPage(
          {
            slugId: generateSlugId(),
            title: createPageDto.title,
            position,
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
          },
          tx,
        );
        await this.pageApprovalService.divertNewPages([inserted.id], tx);
        return inserted;
      },
      trx,
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

  async nextPagePosition(
    spaceId: string,
    parentPageId?: string,
    trx?: KyselyTransaction,
  ) {
    let pagePosition: string;

    const lastPageQuery = dbOrTx(this.db, trx)
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
    const state = await this.pageApprovalService.getState(page);
    if (state.controlled) {
      if (updatePageDto.draft !== true) {
        throw new BadRequestException(
          'This page requires approval. Send draft: true to edit its draft.',
        );
      }
      if (state.locked) {
        throw new BadRequestException(PAGE_LOCKED_MESSAGE);
      }
    }

    if (state.controlled && !state.unpublished) {
      // The page row holds the reader version, so draft edits never touch it.
      await this.updateDraftTitleIcon(page.id, updatePageDto);
    } else {
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
    }

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
      await this.sendPageContent(
        page.id,
        updatePageDto.content,
        updatePageDto.operation,
        updatePageDto.format,
        user,
      );
    }

    const updatedPage = await this.pageRepo.findById(page.id, {
      includeSpace: true,
      includeContent: true,
      includeCreator: true,
      includeLastUpdatedBy: true,
      includeContributors: true,
    });
    if (!state.controlled) return updatedPage;

    const draft = await this.pageApprovalService.readContentFor(
      user,
      updatedPage,
    );
    return {
      ...updatedPage,
      content: draft.content,
      title: draft.title,
      icon: draft.icon,
    };
  }

  async updatePageContent(
    pageId: string,
    content: string | object,
    operation: ContentOperation,
    format: ContentFormat,
    user: User,
  ): Promise<void> {
    // Checked here because a lock error from a remote collab instance only surfaces as a timeout.
    const page = await this.pageRepo.findById(pageId);
    if (page && (await this.pageApprovalService.getState(page)).locked) {
      throw new BadRequestException(PAGE_LOCKED_MESSAGE);
    }

    await this.sendPageContent(pageId, content, operation, format, user);
  }

  private async sendPageContent(
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

  private async updateDraftTitleIcon(
    pageId: string,
    changes: Pick<UpdatePageDto, 'title' | 'icon'>,
  ): Promise<void> {
    if (changes.title === undefined && changes.icon === undefined) return;

    // Like the collab load path, create the draft row when a controlled page has none yet.
    if (!(await this.pageDraftRepo.findByPageId(pageId))) {
      await this.pageDraftRepo.createFromPage(pageId);
    }
    await this.pageDraftRepo.updateTitleIcon(pageId, toDraftTitleIcon(changes));
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
        'updatedAt',
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
      const [hasRestrictions, hasControlledPages] = await Promise.all([
        this.pagePermissionRepo.hasRestrictedPagesInSpace(spaceId),
        this.pagePermissionRepo.hasControlledPagesInSpace(spaceId),
      ]);

      if (!hasRestrictions && !hasControlledPages) {
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
    const moved = await executeTx(this.db, async (trx) => {
      await this.pageRepo.lockPageHierarchySpaces(
        [rootPage.spaceId, spaceId],
        trx,
      );

      const currentRootPage = await this.pageRepo.findById(rootPage.id, {
        trx,
      });
      if (!currentRootPage || currentRootPage.deletedAt) {
        throw new NotFoundException('Page to move not found');
      }
      if (currentRootPage.spaceId !== rootPage.spaceId) {
        throw new ConflictException('Page location changed; retry the move');
      }

      const approvalPlan = await this.planApprovalMove(
        currentRootPage.spaceId,
        spaceId,
        trx,
      );
      if (approvalPlan.requiresSourceAdmin) {
        const ability = await this.spaceAbility.createForUser(
          { id: userId } as User,
          currentRootPage.spaceId,
        );
        if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
          throw new ForbiddenException(MOVE_OUT_OF_APPROVAL_MESSAGE);
        }
      }

      const allPages = await this.pageRepo.getPageAndDescendants(
        currentRootPage.id,
        { includeContent: false, trx },
      );
      const accessiblePages = await this.filterAccessibleTreePages(
        allPages,
        currentRootPage.id,
        userId,
        currentRootPage.spaceId,
      );
      const accessibleIds = new Set(accessiblePages.map((p) => p.id));
      const pagesToOrphan = allPages.filter(
        (p) =>
          !accessibleIds.has(p.id) &&
          p.parentPageId &&
          accessibleIds.has(p.parentPageId),
      );

      // Orphan inaccessible child pages (make them root pages in original space)
      for (const page of pagesToOrphan) {
        const orphanPosition = await this.nextPagePosition(
          currentRootPage.spaceId,
          null,
          trx,
        );
        await this.pageRepo.updatePage(
          { parentPageId: null, position: orphanPosition },
          page.id,
          trx,
        );
      }

      // Update root page
      const nextPosition = await this.nextPagePosition(spaceId, null, trx);
      await this.pageRepo.updatePage(
        { spaceId, parentPageId: null, position: nextPosition },
        currentRootPage.id,
        trx,
      );

      const pageIdsToMove = accessiblePages.map((p) => p.id);

      const childPageIds = pageIdsToMove.filter(
        (id) => id !== currentRootPage.id,
      );

      if (pageIdsToMove.length > 1) {
        // Update sub pages (all accessible pages except root)
        await this.pageRepo.updatePages({ spaceId }, childPageIds, trx);
      }

      if (pageIdsToMove.length > 0) {
        await trx
          .updateTable('pageAccess')
          .set({ spaceId: spaceId })
          .where('pageId', 'in', pageIdsToMove)
          .execute();

        // update spaceId in shares
        await trx
          .updateTable('shares')
          .set({ spaceId: spaceId })
          .where('pageId', 'in', pageIdsToMove)
          .execute();

        // Update comments
        await trx
          .updateTable('comments')
          .set({ spaceId: spaceId })
          .where('pageId', 'in', pageIdsToMove)
          .execute();

        // Update page verifications
        await trx
          .updateTable('pageVerifications')
          .set({ spaceId: spaceId })
          .where('pageId', 'in', pageIdsToMove)
          .execute();

        // Update notifications — access follows the page after a move
        await trx
          .updateTable('notifications')
          .set({ spaceId: spaceId })
          .where('pageId', 'in', pageIdsToMove)
          .execute();

        // Update attachments
        await this.attachmentRepo.updateAttachmentsByPageId(
          { spaceId },
          pageIdsToMove,
          trx,
        );

        // Update watchers and remove those without access to new space
        await this.watcherService.movePageWatchersToSpace(
          pageIdsToMove,
          spaceId,
          {
            trx,
          },
        );

        await this.aiQueue.add(
          QueueJob.PAGE_MOVED_TO_SPACE,
          {
            pageIds: pageIdsToMove,
            spaceId,
            workspaceId: currentRootPage.workspaceId,
          },
          {
            attempts: 2,
            backoff: {
              type: 'fixed',
              delay: 2 * 60 * 1000,
            },
          },
        );
      }

      const { published, removedApproverIds } = await this.applyApprovalMove(
        approvalPlan,
        pageIdsToMove,
        trx,
      );
      const movedById = new Map(accessiblePages.map((p) => [p.id, p]));
      return {
        childPageIds,
        removedApproverIds,
        published: published.map(({ pageId, content }) => ({
          page: { ...movedById.get(pageId), spaceId } as Page,
          content,
        })),
      };
    });

    if (moved.removedApproverIds.length > 0) {
      this.logger.debug(
        `Moving page ${rootPage.id} into an approval space removed page approvers: ${moved.removedApproverIds.join(', ')}`,
      );
    }

    for (const { page, content } of moved.published) {
      await this.pageApprovalPublishService.runPostPublish({
        page,
        content,
        actorId: userId,
        notifyWatchers: false,
      });
    }

    await this.collabAccessService.recheckAccess({ pageIds: [rootPage.id] });
    await this.wsService.invalidateSpaceRestrictionCache(spaceId);
    await this.wsService.removeBaseSubscribersWithoutAccess([rootPage.id]);

    return {
      childPageIds: moved.childPageIds,
      removedApproverIds: moved.removedApproverIds,
    };
  }

  private async planApprovalMove(
    sourceSpaceId: string,
    targetSpaceId: string,
    trx: KyselyTransaction,
  ) {
    const spaces = await trx
      .selectFrom('spaces')
      .select(['id', 'settings'])
      .where('id', 'in', [sourceSpaceId, targetSpaceId])
      .execute();
    const space = (id: string) => ({
      id,
      settings: spaces.find((row) => row.id === id)?.settings ?? null,
    });
    return planSpaceMove(space(sourceSpaceId), space(targetSpaceId));
  }

  // Runs after the moved rows carry the target space id.
  private async applyApprovalMove(
    plan: ReturnType<typeof planSpaceMove>,
    pageIds: string[],
    trx: KyselyTransaction,
  ): Promise<{
    published: Array<{ pageId: string; content: any }>;
    removedApproverIds: string[];
  }> {
    const unchanged = { published: [], removedApproverIds: [] };
    if (pageIds.length === 0) return unchanged;

    if (plan.divertMovedPages) {
      await this.pageApprovalService.divertNewPages(pageIds, trx);
      await this.pageApprovalService.convertExpiringToSpaceControl(
        pageIds,
        trx,
      );
      const removedApproverIds =
        await this.pageApprovalService.removePageApprovers(pageIds, trx);
      return { published: [], removedApproverIds };
    }
    if (!plan.publishSpaceControlled) return unchanged;

    const publishIds =
      await this.pageApprovalService.findSpaceControlledPageIds(pageIds, trx);
    if (publishIds.length === 0) return unchanged;

    const published: Array<{ pageId: string; content: any }> = [];
    for (const pageId of publishIds) {
      const { content } =
        await this.pageApprovalPublishService.publishDraftToPage(pageId, trx);
      published.push({ pageId, content });
    }
    await trx
      .deleteFrom('pageVerifications')
      .where('pageId', 'in', publishIds)
      .where('source', '=', 'space')
      .execute();

    return { published, removedApproverIds: [] };
  }

  async duplicatePage(
    rootPage: Page,
    targetSpaceId: string | undefined,
    authUser: User,
  ) {
    const spaceId = targetSpaceId || rootPage.spaceId;
    const isDuplicateInSameSpace =
      !targetSpaceId || targetSpaceId === rootPage.spaceId;

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
        const pageContent = getProsemirrorContent(page.content);
        const pageFromMap = pageMap.get(page.id);

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

        // Add "Copy of " prefix to the root page title only for duplicates in same space
        let title = page.title;
        if (isDuplicateInSameSpace && page.id === rootPage.id) {
          const originalTitle = getPageTitle(page.title);
          title = `Copy of ${originalTitle}`;
        }

        return {
          id: pageFromMap.newPageId,
          slugId: pageFromMap.newSlugId,
          title: title,
          icon: page.icon,
          content: prosemirrorJson,
          textContent: jsonToText(prosemirrorJson),
          ydoc: createYdocFromJson(prosemirrorJson),
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
      }),
    );

    await executeTx(this.db, async (trx) => {
      await trx.insertInto('pages').values(insertablePages).execute();
      await this.labelRepo.copyLabelsToPages(
        new Map([...pageMap].map(([oldId, entry]) => [oldId, entry.newPageId])),
        trx,
      );
      await this.pageApprovalService.divertNewPages(
        Array.from(pageMap.values(), (entry) => entry.newPageId),
        trx,
      );
    });

    // Extract transclusions from every duplicated page and persist them in
    // one statement. Duplication bypasses Yjs onStoreDocument; brand-new
    // pages never have prior rows so we can skip the diff and just bulk-insert.
    try {
      await this.transclusionService.insertTransclusionsForPages(
        insertablePages.map((p) => ({
          id: p.id,
          workspaceId: p.workspaceId,
          content: p.content,
        })),
      );
    } catch (err) {
      this.logger.error(
        'Failed to insert transclusions for duplicated pages',
        err,
      );
    }

    try {
      await this.transclusionService.insertReferencesForPages(
        insertablePages.map((p) => ({
          id: p.id,
          workspaceId: p.workspaceId,
          content: p.content,
        })),
      );
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

    const mayLoseAccess = await executeTx(this.db, async (trx) => {
      await this.pageRepo.lockPageHierarchySpaces(
        [movedPage.spaceId],
        trx,
      );

      const currentPage = await this.pageRepo.findById(dto.pageId, { trx });
      if (!currentPage || currentPage.deletedAt) {
        throw new NotFoundException('Moved page not found');
      }
      if (currentPage.spaceId !== movedPage.spaceId) {
        throw new ConflictException('Page location changed; retry the move');
      }

      let parentPageId = null;
      if (currentPage.parentPageId === dto.parentPageId) {
        parentPageId = undefined;
      } else {
        if (dto.parentPageId) {
          const parentPage = await this.pageRepo.findById(dto.parentPageId, {
            trx,
          });
          if (
            !parentPage ||
            parentPage.deletedAt ||
            parentPage.spaceId !== currentPage.spaceId
          ) {
            throw new NotFoundException('Parent page not found');
          }
          if (
            await this.pageRepo.isPageDescendant(
              dto.pageId,
              parentPage.id,
              trx,
            )
          ) {
            throw new BadRequestException(
              'A page cannot be moved under its descendant',
            );
          }
          parentPageId = parentPage.id;
        }
      }

      await this.pageRepo.updatePage(
        {
          position: dto.position,
          parentPageId: parentPageId,
        },
        dto.pageId,
        trx,
      );

      // a new parent only changes access in a space with restricted or approval-controlled pages
      if (parentPageId === undefined) return false;
      return (
        (await this.pagePermissionRepo.hasRestrictedPagesInSpace(
          currentPage.spaceId,
          { trx },
        )) ||
        (await this.pagePermissionRepo.hasControlledPagesInSpace(
          currentPage.spaceId,
          { trx },
        ))
      );
    });

    if (mayLoseAccess) {
      await this.collabAccessService.recheckAccess({ pageIds: [dto.pageId] });
      await this.wsService.removeBaseSubscribersWithoutAccess([dto.pageId]);
    }
  }

  async getPageBreadCrumbs(childPageId: string, userId: string) {
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

    const breadcrumbs = ancestors.reverse();
    const ancestorIds = breadcrumbs
      .map((page) => page.id)
      .filter((id) => id !== childPageId);
    if (ancestorIds.length === 0) return breadcrumbs;

    // A user who can open a page may still be unable to see an ancestor, such as an unpublished one.
    const visibleIds = new Set(
      await this.pagePermissionRepo.filterAccessiblePageIds({
        pageIds: ancestorIds,
        userId,
      }),
    );
    return breadcrumbs.filter(
      (page) => page.id === childPageId || visibleIds.has(page.id),
    );
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

  // Trashing takes approved content away from readers, for the page and its whole subtree.
  async removePage(page: Page, user: User, workspaceId: string): Promise<void> {
    const publishedPages =
      await this.pageRepo.findPublishedControlledInSubtree(page.id);
    for (const publishedPage of publishedPages) {
      if (
        !(await this.pageApprovalService.isWorkflowManager(user, publishedPage))
      ) {
        throw new ForbiddenException(TRASH_APPROVED_PAGE_MESSAGE);
      }
    }

    await this.pageRepo.removePage(page.id, user.id, workspaceId);
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
