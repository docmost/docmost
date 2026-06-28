import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertableScimToken,
  ScimToken,
  UpdatableScimToken,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class ScimTokenRepo {
  private baseFields: Array<keyof ScimToken> = [
    'id',
    'name',
    'tokenLastFour',
    'isEnabled',
    'creatorId',
    'workspaceId',
    'lastUsedAt',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insert(
    data: InsertableScimToken,
    trx?: KyselyTransaction,
  ): Promise<ScimToken> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('scimTokens')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async findById(
    id: string,
    workspaceId: string,
    opts?: { includeCreator?: boolean },
  ): Promise<ScimToken | undefined> {
    let query = this.db
      .selectFrom('scimTokens')
      .select(this.baseFields)
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null);

    if (opts?.includeCreator) {
      query = query.select((eb) => this.withCreator(eb));
    }

    return query.executeTakeFirst();
  }

  async findByTokenHash(tokenHash: string): Promise<ScimToken | undefined> {
    return this.db
      .selectFrom('scimTokens')
      .selectAll()
      .where('tokenHash', '=', tokenHash)
      .where('deletedAt', 'is', null)
      .where('isEnabled', '=', true)
      .executeTakeFirst();
  }

  async listPaginated(workspaceId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('scimTokens')
      .select(this.baseFields)
      .select((eb) => this.withCreator(eb))
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'desc');

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'createdAt', direction: 'desc' }],
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
      }),
    });
  }

  async update(
    id: string,
    workspaceId: string,
    data: UpdatableScimToken,
  ): Promise<ScimToken> {
    return this.db
      .updateTable('scimTokens')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
  }

  async softDelete(id: string, workspaceId: string): Promise<void> {
    await this.db
      .updateTable('scimTokens')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.db
      .updateTable('scimTokens')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }

  private withCreator(eb: ExpressionBuilder<DB, 'scimTokens'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['id', 'name', 'email', 'avatarUrl'])
        .whereRef('users.id', '=', 'scimTokens.creatorId'),
    ).as('creator');
  }
}
