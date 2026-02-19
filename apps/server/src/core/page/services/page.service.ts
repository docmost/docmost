import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { InsertablePage, Page, User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  CursorPaginationResult,
  executeWithCursorPagination,
} from '@docmost/db/pagination/cursor-pagination';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { MovePageDto } from '../dto/move-page.dto';
import { generateSlugId } from '../../../common/helpers';
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
import { jsonToNode, jsonToText } from 'src/collaboration/collaboration.util';
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
import {
  PageNodeMetaRepo,
  PageNodeType,
} from '@docmost/db/repos/page/page-node-meta.repo';
import { BatchMovePageDto } from '../dto/batch-move-page.dto';
import { sql } from 'kysely';

type SidebarCountFields = {
  directChildCount: number;
  directChildFolderCount: number;
  descendantFolderCount: number;
  descendantFileCount: number;
  descendantTotalCount: number;
};

@Injectable()
export class PageService {
  private readonly logger = new Logger(PageService.name);

  constructor(
    private pageRepo: PageRepo,
    private pageNodeMetaRepo: PageNodeMetaRepo,
    private attachmentRepo: AttachmentRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly storageService: StorageService,
    @InjectQueue(QueueName.ATTACHMENT_QUEUE) private attachmentQueue: Queue,
    @InjectQueue(QueueName.AI_QUEUE) private aiQueue: Queue,
    private eventEmitter: EventEmitter2,
  ) {}

  async findById(
    pageId: string,
    includeContent?: boolean,
    includeYdoc?: boolean,
    includeSpace?: boolean,
    workspaceId?: string,
  ): Promise<Page> {
    return this.pageRepo.findById(pageId, {
      workspaceId,
      includeContent,
      includeYdoc,
      includeSpace,
    });
  }

  async getPageInfo(pageId: string, workspaceId?: string): Promise<
    | (Page & {
        nodeType: PageNodeType;
        isPinned: boolean;
        pinnedAt: Date | null;
      })
    | undefined
  > {
    const page = await this.pageRepo.findById(pageId, {
      workspaceId,
      includeSpace: true,
      includeContent: true,
      includeCreator: true,
      includeLastUpdatedBy: true,
      includeContributors: true,
    });

    if (!page) {
      return undefined;
    }

    const nodeMeta = await this.safeFindNodeMeta(page.id);

    return {
      ...page,
      nodeType: this.normalizeNodeType(nodeMeta?.nodeType),
      isPinned: nodeMeta?.isPinned ?? false,
      pinnedAt: nodeMeta?.pinnedAt ?? null,
    };
  }

  async create(
    userId: string,
    workspaceId: string,
    createPageDto: CreatePageDto,
  ): Promise<
    Page & {
      nodeType: PageNodeType;
      isPinned: boolean;
      pinnedAt: Date | null;
    }
  > {
    const nodeType = this.normalizeNodeType(createPageDto.nodeType);

    let parentPageId = undefined;
    let parentNodeType: PageNodeType | null = null;

    // check if parent page exists
    if (createPageDto.parentPageId) {
      const parentPage = await this.pageRepo.findById(
        createPageDto.parentPageId,
        { workspaceId },
      );

      if (!parentPage || parentPage.spaceId !== createPageDto.spaceId) {
        throw new NotFoundException('Parent page not found');
      }

      const parentMeta = await this.safeFindNodeMeta(parentPage.id);
      parentNodeType = this.normalizeNodeType(parentMeta?.nodeType);
      parentPageId = parentPage.id;
    }

    this.assertParentChildHierarchy({
      childNodeType: nodeType,
      parentNodeType,
    });

    const createdPage = await this.pageRepo.insertPage({
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
    });

    await this.safeEnsureNodeMeta({
      pageId: createdPage.id,
      workspaceId: workspaceId,
      spaceId: createPageDto.spaceId,
      nodeType,
      isPinned: false,
    });

    return {
      ...createdPage,
      nodeType,
      isPinned: false,
      pinnedAt: null,
    };
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
    userId: string,
  ): Promise<Page> {
    const contributors = new Set<string>(page.contributorIds);
    contributors.add(userId);
    const contributorIds = Array.from(contributors);

    await this.pageRepo.updatePage(
      {
        title: updatePageDto.title,
        icon: updatePageDto.icon,
        lastUpdatedById: userId,
        updatedAt: new Date(),
        contributorIds: contributorIds,
      },
      page.id,
      undefined,
      page.workspaceId,
    );

    return await this.pageRepo.findById(page.id, {
      workspaceId: page.workspaceId,
      includeSpace: true,
      includeContent: true,
      includeCreator: true,
      includeLastUpdatedBy: true,
      includeContributors: true,
    });
  }

  async getSidebarPages(
    spaceId: string,
    pagination: PaginationOptions,
    workspaceId?: string,
    pageId?: string,
  ): Promise<
    CursorPaginationResult<
      Partial<Page> & {
        hasChildren: boolean;
        nodeType: string;
        isPinned: boolean;
        pinnedAt: Date | null;
        pinSortOrder: number;
        pinnedAtSort: Date;
        directChildCount: number;
        directChildFolderCount: number;
        descendantFolderCount: number;
        descendantFileCount: number;
        descendantTotalCount: number;
      }
    >
  > {
    const pinSortExpression = sql<number>`
      coalesce(
        case when "page_node_meta"."is_pinned" = true then 1 else 0 end,
        0
      )
    `;
    const pinnedAtSortExpression = sql<Date>`
      coalesce("page_node_meta"."pinned_at", to_timestamp(0))
    `;
    const sidebarSortFields = [
      {
        expression: pinSortExpression,
        key: 'pinSortOrder',
        direction: 'desc',
      },
      {
        expression: pinnedAtSortExpression,
        key: 'pinnedAtSort',
        direction: 'desc',
      },
      {
        expression: 'pages.position',
        direction: 'asc',
        orderModifier: (ob) => ob.collate('C').asc(),
      },
      { expression: 'pages.id', direction: 'asc' },
    ] as const;

    let query = this.db
      .selectFrom('pages')
      .leftJoin('pageNodeMeta', 'pageNodeMeta.pageId', 'pages.id')
      .select([
        'pages.id as id',
        'pages.slugId as slugId',
        'pages.title as title',
        'pages.icon as icon',
        'pages.position as position',
        'pages.parentPageId as parentPageId',
        'pages.spaceId as spaceId',
        'pages.creatorId as creatorId',
        'pages.deletedAt as deletedAt',
        'pageNodeMeta.pinnedAt as pinnedAt',
      ])
      .select((eb) =>
        eb
          .case()
          .when('pageNodeMeta.nodeType', 'is', null)
          .then('file')
          .else(eb.ref('pageNodeMeta.nodeType'))
          .end()
          .as('nodeType'),
      )
      .select((eb) =>
        eb
          .case()
          .when('pageNodeMeta.isPinned', '=', true)
          .then(true)
          .else(false)
          .end()
          .as('isPinned'),
      )
      .select(pinSortExpression.as('pinSortOrder'))
      .select(pinnedAtSortExpression.as('pinnedAtSort'))
      .select((eb) => this.pageRepo.withHasChildren(eb))
      .$if(Boolean(workspaceId), (qb) =>
        qb.where('pages.workspaceId', '=', workspaceId!),
      )
      .where('pages.deletedAt', 'is', null)
      .where('pages.spaceId', '=', spaceId);

    if (pageId) {
      query = query.where('pages.parentPageId', '=', pageId);
    } else {
      // Keep legacy root files visible during gradual migration rollout.
      query = query.where('pages.parentPageId', 'is', null);
    }

    try {
      const paginatedResult = await executeWithCursorPagination(query, {
        perPage: 250,
        cursor: pagination.cursor,
        beforeCursor: pagination.beforeCursor,
        fields: sidebarSortFields,
        parseCursor: (cursor) => {
          const parsed = cursor as Record<string, string>;
          return {
            pinSortOrder: Number(parsed.pinSortOrder),
            pinnedAtSort: new Date(parsed.pinnedAtSort),
            position: parsed.position,
            id: parsed.id,
          };
        },
      });

      const enrichedItems = await this.enrichSidebarItemsWithCounts(
        paginatedResult.items,
        spaceId,
      );

      return {
        ...paginatedResult,
        items: enrichedItems,
      };
    } catch (err) {
      if (!this.isMissingTableError(err)) {
        throw err;
      }

      let legacyQuery = this.db
        .selectFrom('pages')
        .select([
          'pages.id as id',
          'pages.slugId as slugId',
          'pages.title as title',
          'pages.icon as icon',
          'pages.position as position',
          'pages.parentPageId as parentPageId',
          'pages.spaceId as spaceId',
          'pages.creatorId as creatorId',
          'pages.deletedAt as deletedAt',
        ])
        .select((eb) => sql<string>`'file'`.as('nodeType'))
        .select((eb) => sql<boolean>`false`.as('isPinned'))
        .select((eb) => sql<Date | null>`null`.as('pinnedAt'))
        .select(() => sql<number>`0`.as('pinSortOrder'))
        .select(() => sql<Date>`to_timestamp(0)`.as('pinnedAtSort'))
        .select((eb) => this.pageRepo.withHasChildren(eb))
        .$if(Boolean(workspaceId), (qb) =>
          qb.where('pages.workspaceId', '=', workspaceId!),
        )
        .where('pages.deletedAt', 'is', null)
        .where('pages.spaceId', '=', spaceId);

      if (pageId) {
        legacyQuery = legacyQuery.where('pages.parentPageId', '=', pageId);
      } else {
        legacyQuery = legacyQuery.where('pages.parentPageId', 'is', null);
      }

      const legacySortFields = [
        {
          expression: 'pages.position',
          direction: 'asc',
          orderModifier: (ob) => ob.collate('C').asc(),
        },
        { expression: 'pages.id', direction: 'asc' },
      ] as const;

      const paginatedResult = await executeWithCursorPagination(legacyQuery, {
        perPage: 250,
        cursor: pagination.cursor,
        beforeCursor: pagination.beforeCursor,
        fields: legacySortFields,
        parseCursor: (cursor) => {
          const parsed = cursor as Record<string, string>;
          return {
            position: parsed.position,
            id: parsed.id,
          };
        },
      });

      const enrichedItems = await this.enrichSidebarItemsWithCounts(
        paginatedResult.items,
        spaceId,
      );

      return {
        ...paginatedResult,
        items: enrichedItems,
      };
    }
  }

  private async enrichSidebarItemsWithCounts<T extends { id: string }>(
    items: T[],
    spaceId: string,
  ): Promise<Array<T & SidebarCountFields>> {
    if (!items.length) {
      return [] as Array<T & SidebarCountFields>;
    }

    const pageIds = items.map((item) => item.id);
    const rootValues = sql.join(pageIds.map((id) => sql`(${id}::uuid)`));
    const pageIdInClause = sql.join(pageIds.map((id) => sql`${id}::uuid`));

    try {
      const directCountsResult = await sql<{
        pageId: string;
        directChildCount: number;
        directChildFolderCount: number;
      }>`
        select
          child.parent_page_id as "pageId",
          count(*)::int as "directChildCount",
          count(*) filter (where coalesce(meta.node_type, 'file') = 'folder')::int as "directChildFolderCount"
        from pages child
        left join page_node_meta meta on meta.page_id = child.id
        where child.parent_page_id in (${pageIdInClause})
          and child.deleted_at is null
          and child.space_id = ${spaceId}
        group by child.parent_page_id
      `.execute(this.db);

      const descendantCountsResult = await sql<{
        pageId: string;
        descendantFolderCount: number;
        descendantFileCount: number;
        descendantTotalCount: number;
      }>`
        with recursive roots(page_id) as (
          values ${rootValues}
        ),
        descendants(root_id, id) as (
          select roots.page_id, child.id
          from roots
          join pages child
            on child.parent_page_id = roots.page_id
           and child.deleted_at is null
           and child.space_id = ${spaceId}
          union all
          select descendants.root_id, child.id
          from descendants
          join pages child
            on child.parent_page_id = descendants.id
           and child.deleted_at is null
           and child.space_id = ${spaceId}
        )
        select
          descendants.root_id as "pageId",
          count(*) filter (where coalesce(meta.node_type, 'file') = 'folder')::int as "descendantFolderCount",
          count(*) filter (where coalesce(meta.node_type, 'file') = 'file')::int as "descendantFileCount",
          count(*)::int as "descendantTotalCount"
        from descendants
        left join page_node_meta meta on meta.page_id = descendants.id
        group by descendants.root_id
      `.execute(this.db);

      const directCountMap = new Map<
        string,
        { directChildCount: number; directChildFolderCount: number }
      >(
        directCountsResult.rows.map((row) => [
          row.pageId,
          {
            directChildCount: Number(row.directChildCount ?? 0),
            directChildFolderCount: Number(row.directChildFolderCount ?? 0),
          },
        ]),
      );
      const descendantCountMap = new Map<
        string,
        {
          descendantFolderCount: number;
          descendantFileCount: number;
          descendantTotalCount: number;
        }
      >(
        descendantCountsResult.rows.map((row) => [
          row.pageId,
          {
            descendantFolderCount: Number(row.descendantFolderCount ?? 0),
            descendantFileCount: Number(row.descendantFileCount ?? 0),
            descendantTotalCount: Number(row.descendantTotalCount ?? 0),
          },
        ]),
      );

      return items.map((item) => {
        const direct = directCountMap.get(item.id);
        const descendant = descendantCountMap.get(item.id);
        return {
          ...item,
          directChildCount: direct?.directChildCount ?? 0,
          directChildFolderCount: direct?.directChildFolderCount ?? 0,
          descendantFolderCount: descendant?.descendantFolderCount ?? 0,
          descendantFileCount: descendant?.descendantFileCount ?? 0,
          descendantTotalCount: descendant?.descendantTotalCount ?? 0,
        };
      });
    } catch (err) {
      if (!this.isMissingTableError(err)) {
        throw err;
      }

      const descendantTotalsResult = await sql<{
        pageId: string;
        descendantTotalCount: number;
      }>`
        with recursive roots(page_id) as (
          values ${rootValues}
        ),
        descendants(root_id, id) as (
          select roots.page_id, child.id
          from roots
          join pages child
            on child.parent_page_id = roots.page_id
           and child.deleted_at is null
           and child.space_id = ${spaceId}
          union all
          select descendants.root_id, child.id
          from descendants
          join pages child
            on child.parent_page_id = descendants.id
           and child.deleted_at is null
           and child.space_id = ${spaceId}
        )
        select
          descendants.root_id as "pageId",
          count(*)::int as "descendantTotalCount"
        from descendants
        group by descendants.root_id
      `.execute(this.db);

      const descendantTotalMap = new Map<string, number>(
        descendantTotalsResult.rows.map((row) => [
          row.pageId,
          Number(row.descendantTotalCount ?? 0),
        ]),
      );

      return items.map((item) => {
        const descendantTotalCount = descendantTotalMap.get(item.id) ?? 0;
        return {
          ...item,
          directChildCount: 0,
          directChildFolderCount: 0,
          descendantFolderCount: 0,
          descendantFileCount: descendantTotalCount,
          descendantTotalCount,
        };
      });
    }
  }

  async movePageToSpace(rootPage: Page, spaceId: string) {
    await executeTx(this.db, async (trx) => {
      // Update root page
      const nextPosition = await this.nextPagePosition(spaceId);
      await this.pageRepo.updatePage(
        { spaceId, parentPageId: null, position: nextPosition },
        rootPage.id,
        trx,
        rootPage.workspaceId,
      );
      const pageIds = await this.pageRepo
        .getPageAndDescendants(rootPage.id, {
          includeContent: false,
          workspaceId: rootPage.workspaceId,
        })
        .then((pages) => pages.map((page) => page.id));
      // The first id is the root page id
      if (pageIds.length > 1) {
        // Update sub pages
        await this.pageRepo.updatePages(
          { spaceId },
          pageIds.filter((id) => id !== rootPage.id),
          trx,
          rootPage.workspaceId,
        );
      }

      if (pageIds.length > 0) {
        try {
          await trx
            .updateTable('pageNodeMeta')
            .set({ spaceId, updatedAt: new Date() })
            .where('workspaceId', '=', rootPage.workspaceId)
            .where('pageId', 'in', pageIds)
            .execute();
        } catch (err) {
          if (!this.isMissingTableError(err)) {
            throw err;
          }
        }

        // update spaceId in shares
        await trx
          .updateTable('shares')
          .set({ spaceId: spaceId })
          .where('workspaceId', '=', rootPage.workspaceId)
          .where('pageId', 'in', pageIds)
          .execute();

        // Update comments
        await trx
          .updateTable('comments')
          .set({ spaceId: spaceId })
          .where('workspaceId', '=', rootPage.workspaceId)
          .where('pageId', 'in', pageIds)
          .execute();

        // Update attachments
        await this.attachmentRepo.updateAttachmentsByPageId(
          { spaceId },
          pageIds,
          {
            workspaceId: rootPage.workspaceId,
            trx,
          },
        );

        await this.aiQueue.add(QueueJob.PAGE_MOVED_TO_SPACE, {
          pageId: pageIds,
          workspaceId: rootPage.workspaceId,
        });
      }
    });
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

    const pages = await this.pageRepo.getPageAndDescendants(rootPage.id, {
      includeContent: true,
      workspaceId: rootPage.workspaceId,
    });

    const pageMap = new Map<string, CopyPageMapEntry>();
    pages.forEach((page) => {
      pageMap.set(page.id, {
        newPageId: uuid7(),
        newSlugId: generateSlugId(),
        oldSlugId: page.slugId,
      });
    });

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
        });

        const prosemirrorJson = prosemirrorDoc.toJSON();

        // Add "Copy of " prefix to the root page title only for duplicates in same space
        let title = page.title;
        if (isDuplicateInSameSpace && page.id === rootPage.id) {
          const originalTitle = page.title || 'Untitled';
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

    await this.db.insertInto('pages').values(insertablePages).execute();

    try {
      const sourceMetaRows = await this.db
        .selectFrom('pageNodeMeta')
        .select(['pageId', 'nodeType'])
        .where('pageId', 'in', pages.map((it) => it.id))
        .execute();
      const nodeTypeBySourceId = new Map(
        sourceMetaRows.map((it) => [
          it.pageId,
          this.normalizeNodeType(it.nodeType),
        ]),
      );

      await this.db
        .insertInto('pageNodeMeta')
        .values(
          pages.map((sourcePage) => ({
            pageId: pageMap.get(sourcePage.id).newPageId,
            workspaceId: sourcePage.workspaceId,
            spaceId: spaceId,
            nodeType: nodeTypeBySourceId.get(sourcePage.id) ?? 'file',
            isPinned: false,
            pinnedAt: null,
          })),
        )
        .onConflict((oc) => oc.column('pageId').doNothing())
        .execute();
    } catch (err) {
      if (!this.isMissingTableError(err)) {
        throw err;
      }
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
      workspaceId: rootPage.workspaceId,
      includeSpace: true,
    });

    const hasChildren = pages.length > 1;

    return {
      ...duplicatedPage,
      hasChildren,
    };
  }

  async movePage(dto: MovePageDto, movedPage: Page) {
    const movedMeta = await this.safeFindNodeMeta(movedPage.id);
    const movedNodeType = this.normalizeNodeType(movedMeta?.nodeType);
    const targetParentId =
      dto.parentPageId === undefined ? movedPage.parentPageId : dto.parentPageId;

    // validate position value by attempting to generate a key
    try {
      generateJitteredKeyBetween(dto.position, null);
    } catch (err) {
      throw new BadRequestException('Invalid move position');
    }

    let parentPageId = null;
    if (movedPage.parentPageId === targetParentId) {
      parentPageId = undefined;
    } else {
      // changing the page's parent
      let targetParentNodeType: PageNodeType | null = null;
      if (targetParentId) {
        const parentPage = await this.pageRepo.findById(targetParentId, {
          workspaceId: movedPage.workspaceId,
        });
        if (!parentPage || parentPage.spaceId !== movedPage.spaceId) {
          throw new NotFoundException('Parent page not found');
        }

        const parentMeta = await this.safeFindNodeMeta(parentPage.id);
        targetParentNodeType = this.normalizeNodeType(parentMeta?.nodeType);
        parentPageId = parentPage.id;
      }

      this.assertParentChildHierarchy({
        childNodeType: movedNodeType,
        parentNodeType: targetParentNodeType,
      });
    }

    await this.pageRepo.updatePage(
      {
        position: dto.position,
        parentPageId: parentPageId,
      },
      dto.pageId,
      undefined,
      movedPage.workspaceId,
    );
  }

  async setPagePinned(pageId: string, isPinned: boolean, workspaceId?: string) {
    const page = await this.pageRepo.findById(pageId, {
      workspaceId,
    });
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const currentMeta = await this.safeFindNodeMeta(page.id);
    const meta = await this.safeUpsertNodeMeta({
      pageId: page.id,
      workspaceId: page.workspaceId,
      spaceId: page.spaceId,
      nodeType: this.normalizeNodeType(currentMeta?.nodeType),
      isPinned,
      pinnedAt: isPinned ? new Date() : null,
    });

    if (!meta) {
      throw new BadRequestException('PIN_NOT_AVAILABLE_BEFORE_MIGRATION');
    }

    return {
      pageId: page.id,
      isPinned: meta.isPinned,
      pinnedAt: meta.pinnedAt,
    };
  }

  async batchMovePages(dto: BatchMovePageDto, workspaceId?: string) {
    const targetFolder = await this.pageRepo.findById(dto.targetFolderId, {
      workspaceId,
    });
    if (!targetFolder || targetFolder.spaceId !== dto.spaceId) {
      throw new NotFoundException('Target folder not found');
    }

    const targetMeta = await this.safeFindNodeMeta(targetFolder.id);
    if (this.normalizeNodeType(targetMeta?.nodeType) !== 'folder') {
      throw new BadRequestException('Target must be a folder');
    }

    const pagesToMove = await this.resolvePagesForBatchMove(
      dto,
      targetFolder.workspaceId,
    );
    if (pagesToMove.length === 0) {
      return {
        taskId: null,
        movedCount: 0,
        failedCount: 0,
        conflicts: [],
      };
    }

    const targetAncestors = await this.db
      .withRecursive('page_ancestors', (db) =>
        db
          .selectFrom('pages')
          .select(['id', 'parentPageId'])
          .where('id', '=', targetFolder.id)
          .where('workspaceId', '=', targetFolder.workspaceId)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select(['p.id', 'p.parentPageId'])
              .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id')
              .where('p.workspaceId', '=', targetFolder.workspaceId),
          ),
      )
      .selectFrom('page_ancestors')
      .select(['id'])
      .execute();

    const ancestorIds = new Set(targetAncestors.map((it) => it.id));

    const targetSiblings = await this.db
      .selectFrom('pages')
      .select(['id', 'title'])
      .where('workspaceId', '=', targetFolder.workspaceId)
      .where('spaceId', '=', dto.spaceId)
      .where('parentPageId', '=', targetFolder.id)
      .where('deletedAt', 'is', null)
      .execute();

    const targetSiblingTitleSet = new Set(
      targetSiblings
        .map((it) => (it.title ?? '').trim().toLowerCase())
        .filter(Boolean),
    );

    const conflicts: Array<{ pageId: string; reason: string }> = [];
    const movablePages: Array<(typeof pagesToMove)[number]> = [];

    for (const page of pagesToMove) {
      if (page.id === targetFolder.id || ancestorIds.has(page.id)) {
        conflicts.push({ pageId: page.id, reason: 'invalid_target_cycle' });
        continue;
      }

      const normalizedTitle = (page.title ?? '').trim().toLowerCase();
      if (
        normalizedTitle &&
        targetSiblingTitleSet.has(normalizedTitle) &&
        page.parentPageId !== targetFolder.id
      ) {
        conflicts.push({ pageId: page.id, reason: 'name_conflict' });
        continue;
      }

      movablePages.push(page);
      if (normalizedTitle) {
        targetSiblingTitleSet.add(normalizedTitle);
      }
    }

    if (movablePages.length === 0) {
      return {
        taskId: null,
        movedCount: 0,
        failedCount: conflicts.length,
        conflicts,
      };
    }

    const lastSibling = await this.db
      .selectFrom('pages')
      .select(['position'])
      .where('workspaceId', '=', targetFolder.workspaceId)
      .where('spaceId', '=', dto.spaceId)
      .where('parentPageId', '=', targetFolder.id)
      .where('deletedAt', 'is', null)
      .orderBy('position', (ob) => ob.collate('C').desc())
      .limit(1)
      .executeTakeFirst();

    let lastPosition = lastSibling?.position ?? null;

    await this.db.transaction().execute(async (trx) => {
      for (const page of movablePages) {
        const nextPosition = generateJitteredKeyBetween(lastPosition, null);
        lastPosition = nextPosition;

        await trx
          .updateTable('pages')
          .set({
            parentPageId: targetFolder.id,
            position: nextPosition,
            updatedAt: new Date(),
          })
          .where('workspaceId', '=', targetFolder.workspaceId)
          .where('id', '=', page.id)
          .execute();
      }
    });

    this.eventEmitter.emit(EventName.PAGE_UPDATED, {
      pageIds: movablePages.map((it) => it.id),
      workspaceId: targetFolder.workspaceId,
    });

    return {
      taskId: uuid7(),
      movedCount: movablePages.length,
      failedCount: conflicts.length,
      conflicts,
    };
  }

  private async resolvePagesForBatchMove(
    dto: BatchMovePageDto,
    workspaceId?: string,
  ) {
    const baseQuery = this.db
      .selectFrom('pages')
      .select(['id', 'title', 'parentPageId', 'spaceId', 'workspaceId'])
      .$if(Boolean(workspaceId), (qb) =>
        qb.where('workspaceId', '=', workspaceId!),
      )
      .where('spaceId', '=', dto.spaceId)
      .where('deletedAt', 'is', null);

    if (dto.selectionMode === 'ids') {
      return baseQuery.where('id', 'in', dto.pageIds ?? []).execute();
    }

    let query = baseQuery;

    if (dto.titleContains?.trim()) {
      const keyword = `%${dto.titleContains.trim()}%`;
      query = query.where(sql<boolean>`LOWER(title) LIKE LOWER(${keyword})`);
    }

    if (dto.excludedPageIds?.length) {
      query = query.where('id', 'not in', dto.excludedPageIds);
    }

    return query.limit(500).execute();
  }

  async startFolderMigration(
    spaceId: string,
    workspaceId: string,
    userId: string,
  ) {
    this.logger.log(
      `[folder-migration.start] workspace=${workspaceId} space=${spaceId} operator=${userId}`,
    );
    await this.ensureFolderMigrationTables();

    const runningJob = await this.db
      .selectFrom('folderMigrationJobs')
      .select(['id'])
      .where('workspaceId', '=', workspaceId)
      .where('spaceId', '=', spaceId)
      .where('status', '=', 'running')
      .executeTakeFirst();
    if (runningJob) {
      throw new BadRequestException('MIGRATION_ALREADY_RUNNING');
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const migrationFolderTitle = `历史迁移文件（${dateStr}）`;

    let migrationFolder = await this.db
      .selectFrom('pages')
      .leftJoin('pageNodeMeta', 'pageNodeMeta.pageId', 'pages.id')
      .select(['pages.id', 'pages.title', 'pages.position', 'pages.spaceId'])
      .where('pages.workspaceId', '=', workspaceId)
      .where('pages.spaceId', '=', spaceId)
      .where('pages.parentPageId', 'is', null)
      .where('pages.deletedAt', 'is', null)
      .where('pages.title', '=', migrationFolderTitle)
      .where('pageNodeMeta.nodeType', '=', 'folder')
      .executeTakeFirst();

    if (!migrationFolder) {
      migrationFolder = await this.create(userId, workspaceId, {
        spaceId,
        title: migrationFolderTitle,
        nodeType: 'folder',
      });
    }

    const rootFiles = await this.db
      .selectFrom('pages')
      .leftJoin('pageNodeMeta', 'pageNodeMeta.pageId', 'pages.id')
      .select(['pages.id', 'pages.title', 'pages.parentPageId', 'pages.position'])
      .where('pages.workspaceId', '=', workspaceId)
      .where('pages.spaceId', '=', spaceId)
      .where('pages.parentPageId', 'is', null)
      .where('pages.deletedAt', 'is', null)
      .where('pages.id', '!=', migrationFolder.id)
      .where((eb) =>
        eb.or([
          eb('pageNodeMeta.nodeType', 'is', null),
          eb('pageNodeMeta.nodeType', '=', 'file'),
        ]),
      )
      .execute();

    const createdJob = await this.db
      .insertInto('folderMigrationJobs')
      .values({
        workspaceId,
        spaceId,
        status: 'running',
        totalCount: rootFiles.length,
        successCount: 0,
        failedCount: 0,
        createdBy: userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    let successCount = 0;
    let failedCount = 0;

    const lastSibling = await this.db
      .selectFrom('pages')
      .select(['position'])
      .where('workspaceId', '=', workspaceId)
      .where('spaceId', '=', spaceId)
      .where('parentPageId', '=', migrationFolder.id)
      .where('deletedAt', 'is', null)
      .orderBy('position', (ob) => ob.collate('C').desc())
      .limit(1)
      .executeTakeFirst();
    let lastPosition = lastSibling?.position ?? null;

    for (const page of rootFiles) {
      try {
        const nextPosition = generateJitteredKeyBetween(lastPosition, null);
        lastPosition = nextPosition;

        await this.db.transaction().execute(async (trx) => {
          await trx
            .updateTable('pages')
            .set({
              parentPageId: migrationFolder.id,
              position: nextPosition,
              updatedAt: new Date(),
            })
            .where('workspaceId', '=', workspaceId)
            .where('id', '=', page.id)
            .execute();

          await trx
            .insertInto('folderMigrationJobItems')
            .values({
              jobId: createdJob.id,
              pageId: page.id,
              oldParentPageId: page.parentPageId,
              newParentPageId: migrationFolder.id,
              oldPosition: page.position,
              newPosition: nextPosition,
              status: 'success',
            })
            .execute();
        });

        successCount++;
      } catch (_err) {
        failedCount++;
        await this.db
          .insertInto('folderMigrationJobItems')
          .values({
            jobId: createdJob.id,
            pageId: page.id,
            oldParentPageId: page.parentPageId,
            newParentPageId: migrationFolder.id,
            oldPosition: page.position,
            newPosition: null,
            status: 'failed',
            errorCode: 'MOVE_FAILED',
          })
          .onConflict((oc) =>
            oc.columns(['jobId', 'pageId']).doUpdateSet({
              status: 'failed',
              errorCode: 'MOVE_FAILED',
              updatedAt: new Date(),
            }),
          )
          .execute();
      }
    }

    const finalStatus = failedCount === 0 ? 'success' : 'failed';
    await this.db
      .updateTable('folderMigrationJobs')
      .set({
        status: finalStatus,
        successCount,
        failedCount,
        updatedAt: new Date(),
      })
      .where('id', '=', createdJob.id)
      .execute();

    const result = {
      jobId: createdJob.id,
      status: finalStatus,
      totalCount: rootFiles.length,
      successCount,
      failedCount,
      migrationFolderId: migrationFolder.id,
    };

    this.logger.log(
      `[folder-migration.finish] workspace=${workspaceId} space=${spaceId} operator=${userId} job=${createdJob.id} status=${finalStatus} total=${rootFiles.length} success=${successCount} failed=${failedCount}`,
    );

    return result;
  }

  async rollbackFolderMigration(jobId: string, workspaceId: string) {
    this.logger.log(
      `[folder-migration.rollback.start] workspace=${workspaceId} job=${jobId}`,
    );
    await this.ensureFolderMigrationTables();

    const job = await this.db
      .selectFrom('folderMigrationJobs')
      .selectAll()
      .where('id', '=', jobId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!job) {
      throw new NotFoundException('Migration job not found');
    }

    if (!['success', 'failed'].includes(job.status)) {
      throw new BadRequestException('JOB_NOT_ROLLBACKABLE');
    }

    const successItems = await this.db
      .selectFrom('folderMigrationJobItems')
      .selectAll()
      .where('jobId', '=', jobId)
      .where('status', '=', 'success')
      .execute();

    for (const item of successItems) {
      await this.db.transaction().execute(async (trx) => {
        await trx
          .updateTable('pages')
          .set({
            parentPageId: item.oldParentPageId ?? null,
            position: item.oldPosition ?? null,
            updatedAt: new Date(),
          })
          .where('workspaceId', '=', workspaceId)
          .where('id', '=', item.pageId)
          .execute();

        await trx
          .updateTable('folderMigrationJobItems')
          .set({
            status: 'rolled_back',
            updatedAt: new Date(),
          })
          .where('id', '=', item.id)
          .execute();
      });
    }

    await this.db
      .updateTable('folderMigrationJobs')
      .set({
        status: 'rolled_back',
        updatedAt: new Date(),
      })
      .where('id', '=', jobId)
      .execute();

    const result = {
      jobId,
      rolledBackCount: successItems.length,
    };

    this.logger.log(
      `[folder-migration.rollback.finish] workspace=${workspaceId} job=${jobId} rolledBack=${successItems.length}`,
    );

    return result;
  }

  private normalizeNodeType(
    nodeType: string | null | undefined,
  ): PageNodeType {
    return nodeType === 'folder' ? 'folder' : 'file';
  }

  private assertParentChildHierarchy(payload: {
    childNodeType: PageNodeType;
    parentNodeType: PageNodeType | null;
  }) {
    const { childNodeType, parentNodeType } = payload;

    if (!parentNodeType && childNodeType !== 'folder') {
      throw new BadRequestException('FILE_MUST_BE_IN_FOLDER');
    }

    if (parentNodeType === 'file' && childNodeType === 'folder') {
      throw new BadRequestException('FOLDER_CANNOT_BE_CHILD_OF_FILE');
    }
  }

  private async safeEnsureNodeMeta(payload: {
    pageId: string;
    workspaceId: string;
    spaceId: string;
    nodeType: PageNodeType;
    isPinned: boolean;
  }) {
    try {
      await this.pageNodeMetaRepo.ensureMeta(payload);
    } catch (err) {
      if (!this.isMissingTableError(err)) {
        throw err;
      }
    }
  }

  private async safeFindNodeMeta(pageId: string) {
    try {
      return await this.pageNodeMetaRepo.findByPageId(pageId);
    } catch (err) {
      if (this.isMissingTableError(err)) {
        return undefined;
      }
      throw err;
    }
  }

  private async safeUpsertNodeMeta(payload: {
    pageId: string;
    workspaceId: string;
    spaceId: string;
    nodeType: PageNodeType;
    isPinned: boolean;
    pinnedAt: Date | null;
  }) {
    try {
      return await this.pageNodeMetaRepo.upsertMeta(payload);
    } catch (err) {
      if (this.isMissingTableError(err)) {
        return undefined;
      }
      throw err;
    }
  }

  private async ensureFolderMigrationTables() {
    try {
      await this.db
        .selectFrom('folderMigrationJobs')
        .select('id')
        .limit(1)
        .execute();
    } catch (err) {
      if (this.isMissingTableError(err)) {
        throw new BadRequestException('FOLDER_MIGRATION_NOT_READY');
      }
      throw err;
    }
  }

  private isMissingTableError(err: unknown) {
    const pgError = err as { code?: string; message?: string } | undefined;
    if (pgError?.code !== '42P01') {
      return false;
    }

    const message = pgError.message?.toLowerCase() ?? '';
    return message.includes('relation') && message.includes('does not exist');
  }

  async getPageBreadCrumbs(childPageId: string, workspaceId?: string) {
    const ancestors = await this.db
      .withRecursive('page_ancestors', (db) =>
        db
          .selectFrom('pages')
          .select([
            'id',
            'slugId',
            'title',
            'icon',
            'position',
            'parentPageId',
            'spaceId',
            'deletedAt',
          ])
          .select((eb) => this.pageRepo.withHasChildren(eb))
          .$if(Boolean(workspaceId), (qb) =>
            qb.where('workspaceId', '=', workspaceId!),
          )
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
                'p.position',
                'p.parentPageId',
                'p.spaceId',
                'p.deletedAt',
              ])
              .select(
                exp
                  .selectFrom('pages as child')
                  .select((eb) =>
                    eb
                      .case()
                      .when(eb.fn.countAll(), '>', 0)
                      .then(true)
                      .else(false)
                      .end()
                      .as('count'),
                  )
                  .whereRef('child.parentPageId', '=', 'id')
                  .where('child.deletedAt', 'is', null)
                  .limit(1)
                  .as('hasChildren'),
              )
              //.select((eb) => this.withHasChildren(eb))
              .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id')
              .$if(Boolean(workspaceId), (qb) =>
                qb.where('p.workspaceId', '=', workspaceId!),
              )
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('page_ancestors')
      .selectAll()
      .execute();

    return ancestors.reverse();
  }

  async getRecentSpacePages(
    spaceId: string,
    pagination: PaginationOptions,
    workspaceId?: string,
  ): Promise<CursorPaginationResult<Page>> {
    return this.pageRepo.getRecentPagesInSpace(spaceId, pagination, workspaceId);
  }

  async getRecentPages(
    userId: string,
    workspaceId: string,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<Page>> {
    return this.pageRepo.getRecentPages(userId, workspaceId, pagination);
  }

  async getDeletedSpacePages(
    spaceId: string,
    pagination: PaginationOptions,
    workspaceId?: string,
  ): Promise<CursorPaginationResult<Page>> {
    return this.pageRepo.getDeletedPagesInSpace(
      spaceId,
      pagination,
      workspaceId,
    );
  }

  async forceDelete(pageId: string, workspaceId: string): Promise<void> {
    // Get all descendant IDs (including the page itself) using recursive CTE
    const descendants = await this.db
      .withRecursive('page_descendants', (db) =>
        db
          .selectFrom('pages')
          .select(['id'])
          .where('id', '=', pageId)
          .where('workspaceId', '=', workspaceId)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select(['p.id'])
              .innerJoin('page_descendants as pd', 'pd.id', 'p.parentPageId')
              .where('p.workspaceId', '=', workspaceId),
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
          workspaceId,
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
      await this.db
        .deleteFrom('pages')
        .where('workspaceId', '=', workspaceId)
        .where('id', 'in', pageIds)
        .execute();
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
}
