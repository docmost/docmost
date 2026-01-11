import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx, executeTx } from '../../utils';
import {
  InsertablePage,
  Page,
  UpdatablePage,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { validate as isValidUUID } from 'uuid';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../../../common/events/event.contants';

@Injectable()
export class PageRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private spaceMemberRepo: SpaceMemberRepo,
    private eventEmitter: EventEmitter2,
  ) {}

  private baseFields: Array<keyof Page> = [
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
  ];

  async findById(
    pageId: string,
    opts?: {
      includeContent?: boolean;
      includeTextContent?: boolean;
      includeYdoc?: boolean;
      includeSpace?: boolean;
      includeCreator?: boolean;
      includeLastUpdatedBy?: boolean;
      includeContributors?: boolean;
      includeHasChildren?: boolean;
      withLock?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Page> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('pages')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .$if(opts?.includeYdoc, (qb) => qb.select('ydoc'))
      .$if(opts?.includeTextContent, (qb) => qb.select('textContent'))
      .$if(opts?.includeHasChildren, (qb) =>
        qb.select((eb) => this.withHasChildren(eb)),
      );

    if (opts?.includeCreator) {
      query = query.select((eb) => this.withCreator(eb));
    }

    if (opts?.includeLastUpdatedBy) {
      query = query.select((eb) => this.withLastUpdatedBy(eb));
    }

    if (opts?.includeContributors) {
      query = query.select((eb) => this.withContributors(eb));
    }

    if (opts?.includeSpace) {
      query = query.select((eb) => this.withSpace(eb));
    }

    if (opts?.withLock && opts?.trx) {
      query = query.forUpdate();
    }

    if (isValidUUID(pageId)) {
      query = query.where('id', '=', pageId);
    } else {
      query = query.where('slugId', '=', pageId);
    }

    return query.executeTakeFirst();
  }

  async updatePage(
    updatablePage: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ) {
    return this.updatePages(updatablePage, [pageId], trx);
  }

  async updatePages(
    updatePageData: UpdatablePage,
    pageIds: string[],
    trx?: KyselyTransaction,
  ) {
    const result = await dbOrTx(this.db, trx)
      .updateTable('pages')
      .set({ ...updatePageData, updatedAt: new Date() })
      .where(
        pageIds.some((pageId) => !isValidUUID(pageId)) ? 'slugId' : 'id',
        'in',
        pageIds,
      )
      .executeTakeFirst();

    this.eventEmitter.emit(EventName.PAGE_UPDATED, {
      pageIds: pageIds,
      workspaceId: updatePageData.workspaceId,
    });

    return result;
  }

  async insertPage(
    insertablePage: InsertablePage,
    trx?: KyselyTransaction,
  ): Promise<Page> {
    const db = dbOrTx(this.db, trx);
    const result = await db
      .insertInto('pages')
      .values(insertablePage)
      .returning(this.baseFields)
      .executeTakeFirst();

    this.eventEmitter.emit(EventName.PAGE_CREATED, {
      pageIds: [result.id],
      workspaceId: result.workspaceId,
    });

    return result;
  }

  async deletePage(pageId: string): Promise<void> {
    let query = this.db.deleteFrom('pages');

    if (isValidUUID(pageId)) {
      query = query.where('id', '=', pageId);
    } else {
      query = query.where('slugId', '=', pageId);
    }

    await query.execute();
  }

  async removePage(
    pageId: string,
    deletedById: string,
    workspaceId: string,
  ): Promise<void> {
    const currentDate = new Date();

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

    if (pageIds.length > 0) {
      await executeTx(this.db, async (trx) => {
        await trx
          .updateTable('pages')
          .set({
            deletedById: deletedById,
            deletedAt: currentDate,
          })
          .where('id', 'in', pageIds)
          .execute();

        await trx.deleteFrom('shares').where('pageId', 'in', pageIds).execute();
      });

      this.eventEmitter.emit(EventName.PAGE_SOFT_DELETED, {
        pageIds: pageIds,
        workspaceId,
      });
    }
  }

  async restorePage(pageId: string, workspaceId: string): Promise<void> {
    // First, check if the page being restored has a deleted parent
    const pageToRestore = await this.db
      .selectFrom('pages')
      .select(['id', 'parentPageId'])
      .where('id', '=', pageId)
      .executeTakeFirst();

    if (!pageToRestore) {
      return;
    }

    // Check if the parent is also deleted
    let shouldDetachFromParent = false;
    if (pageToRestore.parentPageId) {
      const parent = await this.db
        .selectFrom('pages')
        .select(['id', 'deletedAt'])
        .where('id', '=', pageToRestore.parentPageId)
        .executeTakeFirst();

      // If parent is deleted, we should detach this page from it
      shouldDetachFromParent = parent?.deletedAt !== null;
    }

    // Find all descendants to restore
    const pages = await this.db
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

    const pageIds = pages.map((p) => p.id);

    // Restore all pages, but only detach the root page if its parent is deleted
    await this.db
      .updateTable('pages')
      .set({ deletedById: null, deletedAt: null })
      .where('id', 'in', pageIds)
      .execute();

    // If we need to detach the restored page from its deleted parent
    if (shouldDetachFromParent) {
      await this.db
        .updateTable('pages')
        .set({ parentPageId: null })
        .where('id', '=', pageId)
        .execute();
    }
    this.eventEmitter.emit(EventName.PAGE_RESTORED, {
      pageIds: pageIds,
      workspaceId: workspaceId,
    });
  }

  async getRecentPagesInSpace(spaceId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select((eb) => this.withSpace(eb))
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null)
      .orderBy('updatedAt', 'desc');

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    return result;
  }

  async getRecentPages(userId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select((eb) => this.withSpace(eb))
      .where('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(userId))
      .where('deletedAt', 'is', null)
      .orderBy('updatedAt', 'desc');

    return executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });
  }

  async getDeletedPagesInSpace(spaceId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select('content')
      .select((eb) => this.withSpace(eb))
      .select((eb) => this.withDeletedBy(eb))
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is not', null)
      // Only include pages that are either root pages (no parent) or whose parent is not deleted
      // This prevents showing orphaned pages when their parent has been soft-deleted
      .where((eb) =>
        eb.or([
          eb('parentPageId', 'is', null),
          eb.not(
            eb.exists(
              eb
                .selectFrom('pages as parent')
                .select('parent.id')
                .where('parent.id', '=', eb.ref('pages.parentPageId'))
                .where('parent.deletedAt', 'is not', null),
            ),
          ),
        ]),
      )
      .orderBy('deletedAt', 'desc');

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    return result;
  }

  withSpace(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('spaces')
        .select(['spaces.id', 'spaces.name', 'spaces.slug'])
        .whereRef('spaces.id', '=', 'pages.spaceId'),
    ).as('space');
  }

  withCreator(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pages.creatorId'),
    ).as('creator');
  }

  withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pages.lastUpdatedById'),
    ).as('lastUpdatedBy');
  }

  withDeletedBy(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pages.deletedById'),
    ).as('deletedBy');
  }

  withContributors(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', sql`ANY(${eb.ref('pages.contributorIds')})`),
    ).as('contributors');
  }

  withHasChildren(eb: ExpressionBuilder<DB, 'pages'>) {
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
      .where('child.deletedAt', 'is', null)
      .limit(1)
      .as('hasChildren');
  }

  async getPageAndDescendants(
    parentPageId: string,
    opts: { includeContent: boolean },
  ) {
    return this.db
      .withRecursive('page_hierarchy', (db) =>
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
            'workspaceId',
          ])
          .$if(opts?.includeContent, (qb) => qb.select('content'))
          .where('id', '=', parentPageId)
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
                'p.workspaceId',
              ])
              .$if(opts?.includeContent, (qb) => qb.select('p.content'))
              .innerJoin('page_hierarchy as ph', 'p.parentPageId', 'ph.id')
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('page_hierarchy')
      .selectAll()
      .execute();
  }
}
