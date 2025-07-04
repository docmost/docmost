import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { calculateBlockHash, dbOrTx } from '../../utils';
import {
  Block,
  ContentBlock,
  InsertablePage,
  InsertableUserPagePreferences,
  Page,
  PageContent,
  UpdatablePage,
  UpdatableUserPagePreferences,
  UserPagePreference,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  executeWithPagination,
  PaginationResult,
} from '@docmost/db/pagination/pagination';
import { validate as isValidUUID } from 'uuid';
import { ExpressionBuilder, sql, UpdateResult } from 'kysely';
import { DB, JsonValue } from '@docmost/db/types/db';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { SidebarPageResultDto } from 'src/core/page/dto/sidebar-page.dto';
import { SearchDTO } from 'src/core/search/dto/search.dto';
import { SearchResponseDto } from 'src/core/search/dto/search-response.dto';
import { SpaceRepo } from '../space/space.repo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsquery = require('pg-tsquery')();

interface FindPageOptions {
  includeContent?: boolean;
  includeYdoc?: boolean;
  includeSpace?: boolean;
  includeCreator?: boolean;
  includeLastUpdatedBy?: boolean;
  includeContributors?: boolean;
  withLock?: boolean;
  trx?: KyselyTransaction;
}

@Injectable()
export class PageRepo {
  private readonly logger = new Logger('PageRepo');

  private readonly baseFields: Array<keyof Page> = [
    'id',
    'slugId',
    'title',
    'icon',
    'coverPhoto',
    'position',
    'parentPageId',
    'creatorId',
    'lastUpdatedById',
    'spaceId',
    'workspaceId',
    'isLocked',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'contributorIds',
    'isSynced',
  ];

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly spaceRepo: SpaceRepo,
  ) {}

  async findById(pageId: string, opts: FindPageOptions = {}): Promise<Page> {
    const db = dbOrTx(this.db, opts.trx);

    let query = this.buildBasePageQuery(db, opts);
    query = this.addPageCondition(query, pageId);

    if (opts.withLock && opts.trx) {
      query = query.forUpdate();
    }

    const page = await query.executeTakeFirst();

    if (!opts.includeContent) {
      return { ...page, content: null };
    }

    return this.attachPageContent(page);
  }

  private async attachPageContent(page: Page): Promise<Page> {
    const pageBlocks = await this.findPageBlocks(page.id);

    if (pageBlocks.length === 0) {
      return { ...page, content: null };
    }

    const pageContent = {
      type: 'doc',
      content: pageBlocks.map((block) => {
        // @ts-ignore
        const blockContent: ContentBlock = { ...block.content };

        if (!blockContent.attrs) {
          blockContent.attrs = {};
        }

        blockContent.attrs.blockId = block.id;
        return blockContent;
      }),
    };

    return { ...page, content: pageContent };
  }

  async findPageBlocks(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<Partial<Block>[]> {
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('blocks')
      .select(['id', 'content'])
      .where('pageId', '=', pageId)
      .execute();
  }

  async updatePageMetadata(
    updatePageData: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<UpdateResult> {
    const db = dbOrTx(this.db, trx);
    const { content, ...pageMetadata } = updatePageData;

    let query = db
      .updateTable('pages')
      .set({ ...pageMetadata, updatedAt: new Date() });

    query = this.addPageCondition(query, pageId);

    return query.executeTakeFirst();
  }

  async getExistingPageBlocks(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<Partial<Block>[]> {
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('blocks')
      .select(['id', 'stateHash'])
      .where('pageId', '=', pageId)
      .orderBy('position', 'asc')
      .execute();
  }

  async createBlock(
    block: any,
    blockId: string,
    pageId: string,
    calculatedHash: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    this.logger.debug('Inserting block', { blockId, pageId });

    await db
      .insertInto('blocks')
      .values({
        id: blockId,
        pageId,
        position: block?.attrs?.position,
        content: block,
        blockType: block?.type,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateHash: calculatedHash,
      })
      .execute();
  }

  async updateExistingBlock(
    block: any,
    blockId: string,
    calculatedHash: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    this.logger.debug('Updating block', { blockId });

    await db
      .updateTable('blocks')
      .set({
        position: block?.attrs?.position,
        content: block,
        updatedAt: new Date(),
        stateHash: calculatedHash,
      })
      .where('id', '=', blockId)
      .execute();
  }

  async deleteBlock(blockId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('blocks').where('id', '=', blockId).execute();
  }

  async insertPage(
    insertablePage: InsertablePage,
    trx?: KyselyTransaction,
  ): Promise<Page> {
    const db = dbOrTx(this.db, trx);

    return db
      .insertInto('pages')
      .values(insertablePage)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async deletePage(pageId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);

    let query = db.deleteFrom('pages');
    query = this.addPageCondition(query, pageId);

    await query.execute();
  }

  async getRecentPagesInSpace(spaceId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select((eb) => this.withSpace(eb))
      .where('spaceId', '=', spaceId)
      .orderBy('updatedAt', 'desc');

    return executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });
  }

  async getSidebarPages(
    spaceId: string,
    pagination: PaginationOptions,
    pageId?: string,
  ): Promise<PaginationResult<SidebarPageResultDto>> {
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
        'isSynced',
      ])
      .select((eb) => this.withHasChildren(eb))
      .orderBy('position', 'asc')
      .where('spaceId', '=', spaceId);

    if (pageId) {
      query = query.where('parentPageId', '=', pageId);
    } else {
      query = query.where('parentPageId', 'is', null);
    }

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: 250,
    });

    return result;
  }

  async getPageBreadCrumbs(childPageId: string): Promise<Partial<Page>[]> {
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
          ])
          .select((eb) => this.withHasChildren(eb))
          .where('id', '=', childPageId)
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
                  .limit(1)
                  .as('hasChildren'),
              )
              //.select((eb) => this.withHasChildren(eb))
              .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id'),
          ),
      )
      .selectFrom('page_ancestors')
      .selectAll()
      .execute();

    return ancestors.reverse();
  }

  async getMyPages(
    userId: string,
    pagination: PaginationOptions,
    pageId?: string,
  ): Promise<PaginationResult<SidebarPageResultDto>> {
    const baseQuery = this.db
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
        'isSynced',
      ])
      .select((eb) => this.withHasChildren(eb))
      .orderBy('position', 'asc');

    const query = baseQuery.where(
      'parentPageId',
      pageId ? '=' : 'is',
      pageId ?? null,
    );

    const result: PaginationResult<SidebarPageResultDto> =
      await executeWithPagination(query, {
        page: pagination.page,
        perPage: 250,
      });

    for (const page of result.items) {
      const preferences = await this.findUserPagePreferences(page.id, userId);

      if (!preferences) {
        await this.createUserPagePreferences({
          pageId: page.id,
          userId: userId,
          position: page.position,
          color: '#4CAF50',
        });
        continue;
      }

      page.position = preferences.position;
      page.color = preferences.color ?? '#4CAF50';
    }

    return result;
  }

  async getRecentPages(userId: string, pagination: PaginationOptions) {
    const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select((eb) => this.withSpace(eb))
      .where('spaceId', 'in', userSpaceIds)
      .orderBy('updatedAt', 'desc');

    return executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
      hasEmptyIds: userSpaceIds.length === 0,
    });
  }

  async getPageAndDescendants(parentPageId: string) {
    return this.db
      .withRecursive('page_hierarchy', (db) =>
        db
          .selectFrom('pages')
          .select([
            'id',
            'slugId',
            'title',
            'icon',
            'parentPageId',
            'spaceId',
            'workspaceId',
          ])
          .where('id', '=', parentPageId)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select([
                'p.id',
                'p.slugId',
                'p.title',
                'p.icon',
                'p.parentPageId',
                'p.spaceId',
                'p.workspaceId',
              ])
              .innerJoin('page_hierarchy as ph', 'p.parentPageId', 'ph.id'),
          ),
      )
      .selectFrom('page_hierarchy')
      .selectAll()
      .execute();
  }

  async createUserPagePreferences(
    preferences: InsertableUserPagePreferences,
  ): Promise<void> {
    await this.db
      .insertInto('userPagePreferences')
      .values(preferences)
      .execute();
  }

  async updateUserPagePreferences(
    preferences: UpdatableUserPagePreferences,
  ): Promise<void> {
    await this.db
      .updateTable('userPagePreferences')
      .set({
        position: preferences.position,
        color: preferences.color,
      })
      .where('userId', '=', preferences.userId)
      .where('pageId', '=', preferences.pageId)
      .execute();
  }

  async findUserPagePreferences(
    pageId: string,
    userId: string,
  ): Promise<UserPagePreference> {
    return this.db
      .selectFrom('userPagePreferences')
      .selectAll()
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .executeTakeFirst();
  }

  async insertContent(
    pageId: string,
    content: PageContent,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);

    // Process blocks sequentially to maintain order and avoid race conditions
    for (const [position, block] of content.content.entries()) {
      await db
        .insertInto('blocks')
        .values({
          pageId,
          blockType: block.type,
          content: block,
          stateHash: calculateBlockHash(block),
          position,
        })
        .execute();
    }
  }

  async findPagesByIdsWithSpace(pageIds: string[], workspaceId: string) {
    return this.db
      .selectFrom('pages')
      .select(['id', 'slugId', 'title', 'creatorId', 'spaceId', 'workspaceId'])
      .select((eb) => this.withSpace(eb))
      .where('id', 'in', pageIds)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async findPagesBySpaceId(spaceId: string) {
    return this.db
      .selectFrom('pages')
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.content',
        'pages.parentPageId',
        'pages.spaceId',
        'pages.workspaceId',
      ])
      .where('spaceId', '=', spaceId)
      .execute();
  }

  async findLastPage(spaceId: string, parentPageId?: string) {
    const lastPageQuery = this.db
      .selectFrom('pages')
      .select(['position'])
      .where('spaceId', '=', spaceId)
      .orderBy('position', 'desc')
      .limit(1);

    if (parentPageId) {
      // check for children of this page
      return lastPageQuery
        .where('parentPageId', '=', parentPageId)
        .executeTakeFirst();
    }

    // for root page
    return lastPageQuery.where('parentPageId', 'is', null).executeTakeFirst();
  }

  async getPagesInSpace(
    spaceId: string,
    pagination?: PaginationOptions,
    trx?: KyselyTransaction,
  ): Promise<PaginationResult<SidebarPageResultDto>> {
    const db = dbOrTx(this.db, trx);

    const query = db
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
        'isSynced',
      ])
      .orderBy('position', 'asc')
      .where('spaceId', '=', spaceId);

    return executeWithPagination(query, {
      page: pagination.page,
      perPage: 250,
    });
  }

  async searchForPage(
    query: string,
    searchParams: SearchDTO,
  ): Promise<SearchResponseDto[]> {
    const searchQuery = tsquery(query.trim() + '*');
    return this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'parentPageId',
        'creatorId',
        'createdAt',
        'updatedAt',
        sql<number>`ts_rank(tsv, to_tsquery(${searchQuery}))`.as('rank'),
        sql<string>`ts_headline('english', text_content, to_tsquery(${searchQuery}),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
          'highlight',
        ),
      ])
      .select((eb) => this.withSpace(eb))
      .$if(Boolean(searchParams.spaceId), (qb) =>
        qb.where('spaceId', '=', searchParams.spaceId),
      )
      .where('tsv', '@@', sql<string>`to_tsquery(${searchQuery})`)
      .$if(Boolean(searchParams.creatorId), (qb) =>
        qb.where('creatorId', '=', searchParams.creatorId),
      )
      .orderBy('rank', 'desc')
      .limit(searchParams.limit | 20)
      .offset(searchParams.offset || 0)
      .execute();
  }

  async searchSuggestionsPages(
    query: string,
    limit: number,
    workspaceId: string,
    userId: string,
    spaceId?: string | null,
  ): Promise<Page[]> {
    let pageSearch = this.db
      .selectFrom('pages')
      .select(['id', 'slugId', 'title', 'icon', 'spaceId'])
      .where((eb) => eb(sql`LOWER(pages.title)`, 'like', `%${query}%`))
      .where('workspaceId', '=', workspaceId)
      .limit(limit);

    // only search spaces the user has access to
    const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

    let pages = [];
    if (spaceId) {
      if (userSpaceIds.includes(spaceId)) {
        pageSearch = pageSearch.where('spaceId', '=', spaceId);
        pages = await pageSearch.execute();
      }
    } else if (userSpaceIds?.length > 0) {
      // we need this check or the query will throw an error if the userSpaceIds array is empty
      pageSearch = pageSearch.where('spaceId', 'in', userSpaceIds);
      pages = await pageSearch.execute();
    }

    return pages;
  }

  private buildBasePageQuery(db: any, opts: FindPageOptions) {
    let query = db
      .selectFrom('pages')
      .select(this.baseFields)
      .$if(opts.includeYdoc, (qb) => qb.select('ydoc'));

    if (opts.includeCreator) {
      query = query.select((eb) => this.withCreator(eb));
    }

    if (opts.includeLastUpdatedBy) {
      query = query.select((eb) => this.withLastUpdatedBy(eb));
    }

    if (opts.includeContributors) {
      query = query.select((eb) => this.withContributors(eb));
    }

    if (opts.includeSpace) {
      query = query.select((eb) => this.withSpace(eb));
    }

    return query;
  }

  private addPageCondition(query: any, pageId: string) {
    if (isValidUUID(pageId)) {
      return query.where('id', '=', pageId);
    }
    return query.where('slugId', '=', pageId);
  }

  private withSpace(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('spaces')
        .select(['spaces.id', 'spaces.name', 'spaces.slug'])
        .whereRef('spaces.id', '=', 'pages.spaceId'),
    ).as('space');
  }

  private withCreator(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pages.creatorId'),
    ).as('creator');
  }

  private withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pages.lastUpdatedById'),
    ).as('lastUpdatedBy');
  }

  private withContributors(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', sql`ANY(${eb.ref('pages.contributorIds')})`),
    ).as('contributors');
  }

  private withHasChildren(eb: ExpressionBuilder<DB, 'pages'>) {
    return eb
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
      .whereRef('child.parentPageId', '=', 'pages.id')
      .limit(1)
      .as('hasChildren');
  }
}
