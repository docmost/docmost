import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { sql } from 'kysely';
import { JsonValue } from '@docmost/db/types/db';

@Injectable()
export class AiChatRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async createChat(workspaceId: string, creatorId: string) {
    return this.db
      .insertInto('aiChats')
      .values({ workspaceId, creatorId, title: null })
      .returningAll()
      .executeTakeFirst();
  }

  async findById(chatId: string, workspaceId: string, creatorId: string) {
    return this.db
      .selectFrom('aiChats')
      .selectAll()
      .where('id', '=', chatId)
      .where('workspaceId', '=', workspaceId)
      .where('creatorId', '=', creatorId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async listChats(
    workspaceId: string,
    creatorId: string,
    pagination: PaginationOptions,
  ) {
    const query = this.db
      .selectFrom('aiChats')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('creatorId', '=', creatorId)
      .where('deletedAt', 'is', null)
      .orderBy('updatedAt', 'desc');

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'updatedAt', direction: 'desc' }],
      parseCursor: (cursor) => ({
        updatedAt: new Date(cursor.updatedAt),
      }),
    });
  }

  async updateTitle(chatId: string, title: string) {
    await this.db
      .updateTable('aiChats')
      .set({ title, updatedAt: new Date() })
      .where('id', '=', chatId)
      .execute();
  }

  async softDelete(chatId: string) {
    await this.db
      .updateTable('aiChats')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', chatId)
      .execute();
  }

  async searchChats(workspaceId: string, creatorId: string, query: string) {
    const term = `%${query}%`;
    return this.db
      .selectFrom('aiChats')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('creatorId', '=', creatorId)
      .where('deletedAt', 'is', null)
      .where((eb) =>
        eb(
          sql`f_unaccent(title)`,
          'ilike',
          sql`f_unaccent(${term})`,
        ),
      )
      .orderBy('updatedAt', 'desc')
      .limit(20)
      .execute();
  }

  async getMessages(chatId: string) {
    return this.db
      .selectFrom('aiChatMessages')
      .selectAll()
      .where('chatId', '=', chatId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  async insertMessage(
    data: {
      chatId: string;
      workspaceId: string;
      userId?: string;
      role: string;
      content: string;
      metadata?: unknown;
    },
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('aiChatMessages')
      .values({
        chatId: data.chatId,
        workspaceId: data.workspaceId,
        userId: data.userId ?? null,
        role: data.role,
        content: data.content,
        metadata: (data.metadata ?? null) as JsonValue | null,
      })
      .returningAll()
      .executeTakeFirst();
  }

  async touchChat(chatId: string) {
    await this.db
      .updateTable('aiChats')
      .set({ updatedAt: new Date() })
      .where('id', '=', chatId)
      .execute();
  }
}
