import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertablePageVerification,
  PageVerification,
  UpdatablePageVerification,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { sql } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class PageVerificationRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByPageId(pageId: string): Promise<PageVerification | undefined> {
    return this.db
      .selectFrom('pageVerifications')
      .selectAll()
      .where('pageId', '=', pageId)
      .executeTakeFirst();
  }

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<PageVerification | undefined> {
    return this.db
      .selectFrom('pageVerifications')
      .selectAll()
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async insert(
    data: InsertablePageVerification,
    trx?: KyselyTransaction,
  ): Promise<PageVerification> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pageVerifications')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async update(
    pageId: string,
    data: UpdatablePageVerification,
    trx?: KyselyTransaction,
  ): Promise<PageVerification> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('pageVerifications')
      .set({ ...data, updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .returningAll()
      .executeTakeFirst();
  }

  async delete(pageId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pageVerifications')
      .where('pageId', '=', pageId)
      .execute();
  }

  async replaceVerifiers(
    pageVerificationId: string,
    verifierIds: string[],
    addedById: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pageVerifiers')
      .where('pageVerificationId', '=', pageVerificationId)
      .execute();

    if (verifierIds.length === 0) return;

    await db
      .insertInto('pageVerifiers')
      .values(
        verifierIds.map((userId, index) => ({
          pageVerificationId,
          userId,
          isPrimary: index === 0,
          addedById,
        })),
      )
      .execute();
  }

  async getVerifiers(pageVerificationId: string) {
    return this.db
      .selectFrom('pageVerifiers')
      .innerJoin('users', 'users.id', 'pageVerifiers.userId')
      .select([
        'users.id',
        'users.name',
        'users.email',
        'users.avatarUrl',
        'pageVerifiers.isPrimary',
      ])
      .where('pageVerificationId', '=', pageVerificationId)
      .orderBy('pageVerifiers.isPrimary', 'desc')
      .orderBy('users.name', 'asc')
      .execute();
  }

  async isVerifier(pageVerificationId: string, userId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('pageVerifiers')
      .select('id')
      .where('pageVerificationId', '=', pageVerificationId)
      .where('userId', '=', userId)
      .executeTakeFirst();
    return !!row;
  }

  async findDetailByPageId(pageId: string) {
    return this.db
      .selectFrom('pageVerifications')
      .selectAll('pageVerifications')
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['id', 'name', 'avatarUrl'])
            .whereRef('users.id', '=', 'pageVerifications.verifiedById'),
        ).as('verifiedBy'),
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['id', 'name', 'avatarUrl'])
            .whereRef('users.id', '=', 'pageVerifications.requestedById'),
        ).as('requestedBy'),
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['id', 'name', 'avatarUrl'])
            .whereRef('users.id', '=', 'pageVerifications.rejectedById'),
        ).as('rejectedBy'),
      ])
      .where('pageId', '=', pageId)
      .executeTakeFirst();
  }

  async listVerifications(
    workspaceId: string,
    accessibleSpaceIds: string[],
    pagination: PaginationOptions,
    filters: {
      spaceIds?: string[];
      verifierId?: string;
      type?: string;
    },
  ) {
    let query = this.db
      .selectFrom('pageVerifications')
      .innerJoin('pages', 'pages.id', 'pageVerifications.pageId')
      .innerJoin('spaces', 'spaces.id', 'pageVerifications.spaceId')
      .select([
        'pageVerifications.id',
        'pageVerifications.pageId',
        'pageVerifications.spaceId',
        'pageVerifications.type',
        'pageVerifications.status',
        'pageVerifications.mode',
        'pageVerifications.periodAmount',
        'pageVerifications.periodUnit',
        'pageVerifications.verifiedAt',
        'pageVerifications.expiresAt',
        'pageVerifications.createdAt',
        'pages.title as pageTitle',
        'pages.slugId as pageSlugId',
        'pages.icon as pageIcon',
        'spaces.name as spaceName',
        'spaces.slug as spaceSlug',
      ])
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('pageVerifiers')
            .innerJoin('users', 'users.id', 'pageVerifiers.userId')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef(
              'pageVerifiers.pageVerificationId',
              '=',
              'pageVerifications.id',
            ),
        ).as('verifiers'),
      )
      .where('pageVerifications.workspaceId', '=', workspaceId)
      .where('pages.deletedAt', 'is', null);

    const spaceFilter =
      filters.spaceIds?.filter((id) => accessibleSpaceIds.includes(id)) ??
      accessibleSpaceIds;

    if (spaceFilter.length === 0) {
      query = query.where(sql<boolean>`false`);
    } else {
      query = query.where('pageVerifications.spaceId', 'in', spaceFilter);
    }

    if (filters.type) {
      query = query.where('pageVerifications.type', '=', filters.type);
    }

    if (filters.verifierId) {
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom('pageVerifiers')
            .select('pageVerifiers.id')
            .whereRef(
              'pageVerifiers.pageVerificationId',
              '=',
              'pageVerifications.id',
            )
            .where('pageVerifiers.userId', '=', filters.verifierId),
        ),
      );
    }

    if (pagination.query) {
      const term = `%${pagination.query}%`;
      query = query.where((eb) =>
        eb(
          sql`f_unaccent(pages.title)`,
          'ilike',
          sql`f_unaccent(${term})`,
        ),
      );
    }

    const listQuery = this.db.selectFrom(query.as('sub')).selectAll('sub');

    return executeWithCursorPagination(listQuery, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'sub.createdAt', direction: 'desc', key: 'createdAt' },
        { expression: 'sub.id', direction: 'asc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      }),
    });
  }

  async findExpiringVerifications(now: Date, warningBefore: Date) {
    return this.db
      .selectFrom('pageVerifications')
      .selectAll()
      .where('type', '=', 'expiring')
      .where('expiresAt', 'is not', null)
      .where('expiresAt', '>', now)
      .where('expiresAt', '<=', warningBefore)
      .execute();
  }

  async findExpiredVerifications(now: Date) {
    return this.db
      .selectFrom('pageVerifications')
      .selectAll()
      .where('type', '=', 'expiring')
      .where('expiresAt', 'is not', null)
      .where('expiresAt', '<=', now)
      .execute();
  }
}
