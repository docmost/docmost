import {
  ApiKey,
  InsertableApiKey,
  UpdatableApiKey,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import {
  executeWithCursorPagination,
  CursorPaginationResult,
} from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class ApiKeyRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields = [
    'apiKeys.id',
    'apiKeys.name',
    'apiKeys.creatorId',
    'apiKeys.workspaceId',
    'apiKeys.expiresAt',
    'apiKeys.lastUsedAt',
    'apiKeys.createdAt',
    'apiKeys.updatedAt',
  ] as const;

  async findById(
    apiKeyId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<ApiKey> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('apiKeys')
      .select(this.baseFields)
      .where('apiKeys.id', '=', apiKeyId)
      .where('apiKeys.workspaceId', '=', workspaceId)
      .where('apiKeys.deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByCreatorId(
    creatorId: string,
    workspaceId: string,
    opts: { limit?: number; cursor?: string; beforeCursor?: string },
  ): Promise<CursorPaginationResult<any>> {
    const query = this.db
      .selectFrom('apiKeys')
      .leftJoin('users', 'users.id', 'apiKeys.creatorId')
      .select([
        ...this.baseFields,
        'users.name as creatorName',
        'users.avatarUrl as creatorAvatarUrl',
      ])
      .where('apiKeys.creatorId', '=', creatorId)
      .where('apiKeys.workspaceId', '=', workspaceId)
      .where('apiKeys.deletedAt', 'is', null);

    return executeWithCursorPagination(query, {
      perPage: opts.limit || 20,
      cursor: opts.cursor,
      beforeCursor: opts.beforeCursor,
      fields: [
        { expression: 'apiKeys.createdAt', direction: 'desc' },
        { expression: 'apiKeys.id', direction: 'desc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      }),
    });
  }

  async findAllInWorkspace(
    workspaceId: string,
    opts: { limit?: number; cursor?: string; beforeCursor?: string },
  ): Promise<CursorPaginationResult<any>> {
    const query = this.db
      .selectFrom('apiKeys')
      .leftJoin('users', 'users.id', 'apiKeys.creatorId')
      .select([
        ...this.baseFields,
        'users.name as creatorName',
        'users.avatarUrl as creatorAvatarUrl',
      ])
      .where('apiKeys.workspaceId', '=', workspaceId)
      .where('apiKeys.deletedAt', 'is', null);

    return executeWithCursorPagination(query, {
      perPage: opts.limit || 20,
      cursor: opts.cursor,
      beforeCursor: opts.beforeCursor,
      fields: [
        { expression: 'apiKeys.createdAt', direction: 'desc' },
        { expression: 'apiKeys.id', direction: 'desc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      }),
    });
  }

  async insertApiKey(
    data: InsertableApiKey,
    trx?: KyselyTransaction,
  ): Promise<ApiKey> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('apiKeys')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async updateApiKey(
    data: UpdatableApiKey,
    apiKeyId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<ApiKey> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('apiKeys')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
  }

  async softDelete(
    apiKeyId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('apiKeys')
      .set({ deletedAt: new Date() })
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async updateLastUsedAt(apiKeyId: string): Promise<void> {
    await this.db
      .updateTable('apiKeys')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', apiKeyId)
      .execute();
  }
}
