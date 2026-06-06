import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  ApiKey,
  InsertableApiKey,
  UpdatableApiKey,
} from '@docmost/db/types/entity.types';
import { ExpressionBuilder, sql } from 'kysely';
import { DB, ApiKeys } from '@docmost/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { PaginationOptions } from '../../pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class ApiKeyRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof ApiKeys> = [
    'id',
    'name',
    'creatorId',
    'workspaceId',
    'expiresAt',
    'lastUsedAt',
    'createdAt',
    'updatedAt',
  ];

  private withCreator(eb: ExpressionBuilder<DB, 'apiKeys'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.email', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'apiKeys.creatorId'),
    ).as('creator');
  }

  async findById(
    apiKeyId: string,
    workspaceId: string,
    opts?: { includeCreator?: boolean; trx?: KyselyTransaction },
  ): Promise<ApiKey> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .selectFrom('apiKeys')
      .select(this.baseFields)
      .$if(Boolean(opts?.includeCreator), (qb) =>
        qb.select((eb) => this.withCreator(eb)),
      )
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  // Used during authentication; loads the key by id regardless of creator.
  async findActiveById(apiKeyId: string): Promise<ApiKey> {
    return this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('id', '=', apiKeyId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async insertApiKey(
    insertable: InsertableApiKey,
    trx?: KyselyTransaction,
  ): Promise<ApiKey> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('apiKeys')
      .values(insertable)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async updateApiKey(
    updatable: UpdatableApiKey,
    apiKeyId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('apiKeys')
      .set({ ...updatable, updatedAt: new Date() })
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async updateLastUsed(apiKeyId: string): Promise<void> {
    await this.db
      .updateTable('apiKeys')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', apiKeyId)
      .execute();
  }

  async softDelete(apiKeyId: string, workspaceId: string): Promise<void> {
    await this.db
      .updateTable('apiKeys')
      .set({ deletedAt: new Date() })
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async getApiKeysPaginated(
    workspaceId: string,
    pagination: PaginationOptions,
    opts?: { creatorId?: string },
  ) {
    let baseQuery = this.db
      .selectFrom('apiKeys')
      .select(this.baseFields)
      .select((eb) => this.withCreator(eb))
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null);

    if (opts?.creatorId) {
      baseQuery = baseQuery.where('creatorId', '=', opts.creatorId);
    }

    if (pagination.query) {
      baseQuery = baseQuery.where((eb) =>
        eb(
          sql`f_unaccent(name)`,
          'ilike',
          sql`f_unaccent(${'%' + pagination.query + '%'})`,
        ),
      );
    }

    const query = this.db.selectFrom(baseQuery.as('sub')).selectAll('sub');

    // ids are time-ordered uuid v7, so a single id cursor yields stable newest-first order
    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'sub.id', direction: 'desc', key: 'id' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }
}
