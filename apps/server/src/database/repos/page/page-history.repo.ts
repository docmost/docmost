import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertablePageHistory,
  Page,
  PageHistory,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@docmost/db/types/db';

@Injectable()
export class PageHistoryRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof PageHistory> = [
    'id',
    'pageId',
    'slugId',
    'title',
    'icon',
    'coverPhoto',
    'lastUpdatedById',
    'contributorIds',
    'spaceId',
    'workspaceId',
    'createdAt',
    'kind',
    'version',
    'changeSummary',
    'approvedById',
    'approvedAt',
  ];

  async findById(
    pageHistoryId: string,
    opts?: {
      includeContent?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<PageHistory> {
    const db = dbOrTx(this.db, opts?.trx);

    return await db
      .selectFrom('pageHistory')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .select((eb) => this.withLastUpdatedBy(eb))
      .select((eb) => this.withApprovedBy(eb))
      .select((eb) => this.withContributors(eb))
      .where('id', '=', pageHistoryId)
      .executeTakeFirst();
  }

  async insertPageHistory(
    insertablePageHistory: InsertablePageHistory,
    trx?: KyselyTransaction,
  ): Promise<PageHistory> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pageHistory')
      .values(insertablePageHistory)
      .returningAll()
      .executeTakeFirst();
  }

  async saveHistory(
    page: Page,
    opts?: {
      contributorIds?: string[];
      trx?: KyselyTransaction;
      kind?: 'draft' | 'approved' | 'baseline';
      changeSummary?: string;
      override?: { title: string; icon: string; content: any };
    },
  ): Promise<void> {
    const source = opts?.override ?? page;

    await this.insertPageHistory(
      {
        pageId: page.id,
        slugId: page.slugId,
        title: source.title,
        content: source.content,
        icon: source.icon,
        coverPhoto: page.coverPhoto,
        lastUpdatedById: page.lastUpdatedById ?? page.creatorId,
        contributorIds: opts?.contributorIds,
        spaceId: page.spaceId,
        workspaceId: page.workspaceId,
        kind: opts?.kind,
        changeSummary: opts?.changeSummary,
      },
      opts?.trx,
    );
  }

  async findPageHistoryByPageId(
    pageId: string,
    pagination: PaginationOptions,
    opts?: { readerOnly?: boolean; includeDraftKinds?: boolean },
  ) {
    const query = this.db
      .selectFrom('pageHistory')
      .select(this.baseFields)
      .select((eb) => this.withLastUpdatedBy(eb))
      .select((eb) => this.withApprovedBy(eb))
      .select((eb) => this.withContributors(eb))
      .where('pageId', '=', pageId)
      .$if(opts?.readerOnly, (qb) =>
        qb.where('kind', 'in', ['approved', 'baseline']),
      )
      // Regular rows have a null kind, so a plain <> would drop them.
      .$if(opts?.includeDraftKinds === false, (qb) =>
        qb.where((eb) =>
          eb.or([eb('kind', 'is', null), eb('kind', '<>', 'draft')]),
        ),
      );

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }

  async findPageLastHistory(
    pageId: string,
    opts?: {
      includeContent?: boolean;
      trx?: KyselyTransaction;
    },
  ) {
    const db = dbOrTx(this.db, opts?.trx);

    return await db
      .selectFrom('pageHistory')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .where('pageId', '=', pageId)
      .limit(1)
      .orderBy('createdAt', 'desc')
      .executeTakeFirst();
  }

  // The row pages.reader_version_id points at, undefined while unpublished.
  async findLatestReaderVersion(
    pageId: string,
    opts?: {
      includeContent?: boolean;
      trx?: KyselyTransaction;
    },
  ) {
    const db = dbOrTx(this.db, opts?.trx);

    return await db
      .selectFrom('pageHistory')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .select((eb) => this.withApprovedBy(eb))
      .where('id', '=', (eb) =>
        eb
          .selectFrom('pages')
          .select('pages.readerVersionId')
          .where('pages.id', '=', pageId),
      )
      .executeTakeFirst();
  }

  async nextApprovedVersion(
    pageId: string,
    trx: KyselyTransaction,
  ): Promise<number> {
    const row = await trx
      .selectFrom('pageHistory')
      .select((eb) =>
        eb.fn.coalesce(eb.fn.max('version'), sql<number>`0`).as('maxVersion'),
      )
      .where('pageId', '=', pageId)
      .where('kind', '=', 'approved')
      .executeTakeFirst();

    return Number(row.maxVersion) + 1;
  }

  // Only a draft snapshot can become a version; reader versions never change.
  async markApproved(
    historyId: string,
    data: { version: number; approvedById: string; approvedAt: Date },
    trx: KyselyTransaction,
  ): Promise<void> {
    const result = await trx
      .updateTable('pageHistory')
      .set({
        kind: 'approved',
        version: data.version,
        approvedById: data.approvedById,
        approvedAt: data.approvedAt,
      })
      .where('id', '=', historyId)
      .where('kind', '=', 'draft')
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0) {
      throw new Error(`History row ${historyId} is not a draft snapshot`);
    }
  }

  // Baselines every non-base page without a qms row, ignoring older versions.
  async insertBaselinesForSpace(
    spaceId: string,
    trx: KyselyTransaction,
  ): Promise<number> {
    await trx
      .selectFrom('pages')
      .select('id')
      .where('spaceId', '=', spaceId)
      .orderBy('id')
      .forUpdate()
      .execute();

    const result = await trx
      .with('inserted', (qb) =>
        qb
          .insertInto('pageHistory')
          .columns([
            'pageId',
            'slugId',
            'title',
            'icon',
            'coverPhoto',
            'content',
            'lastUpdatedById',
            'contributorIds',
            'spaceId',
            'workspaceId',
            'kind',
          ])
          .expression((eb) =>
            eb
              .selectFrom('pages')
              .select((pe) => [
                'pages.id',
                'pages.slugId',
                'pages.title',
                'pages.icon',
                'pages.coverPhoto',
                'pages.content',
                pe.fn
                  .coalesce('pages.lastUpdatedById', 'pages.creatorId')
                  .as('lastUpdatedById'),
                'pages.contributorIds',
                'pages.spaceId',
                'pages.workspaceId',
                sql.lit('baseline').as('kind'),
              ])
              .where('pages.spaceId', '=', spaceId)
              .where('pages.isBase', '=', false)
              .where(({ not, exists, selectFrom }) =>
                not(
                  exists(
                    selectFrom('pageVerifications')
                      .select('pageVerifications.id')
                      .whereRef('pageVerifications.pageId', '=', 'pages.id')
                      .where('pageVerifications.type', '=', 'qms'),
                  ),
                ),
              ),
          )
          .returning(['id', 'pageId']),
      )
      .with('pointed', (qb) =>
        qb
          .updateTable('pages')
          .from('inserted')
          .set((eb) => ({ readerVersionId: eb.ref('inserted.id') }))
          .whereRef('pages.id', '=', 'inserted.pageId')
          .returning('pages.id'),
      )
      .with('published', (qb) =>
        qb
          .updateTable('attachments')
          .set({ publishedAt: sql`now()` })
          .where('deletedAt', 'is', null)
          .where('publishedAt', 'is', null)
          .where('pageId', 'in', (eb) =>
            eb.selectFrom('inserted').select('inserted.pageId'),
          )
          .returning('attachments.id'),
      )
      .selectFrom('inserted')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst();

    return Number(result.count);
  }

  withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pageHistory'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pageHistory.lastUpdatedById'),
    ).as('lastUpdatedBy');
  }

  withApprovedBy(eb: ExpressionBuilder<DB, 'pageHistory'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pageHistory.approvedById'),
    ).as('approvedBy');
  }

  withContributors(eb: ExpressionBuilder<DB, 'pageHistory'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef(
          'users.id',
          '=',
          sql`ANY(${eb.ref('pageHistory.contributorIds')})`,
        ),
    ).as('contributors');
  }
}
