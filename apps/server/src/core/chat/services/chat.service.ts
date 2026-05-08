import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { v7 as uuidv7 } from 'uuid';
import { sql } from 'kysely';
import { MinimaxService } from './minimax.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly minimaxService: MinimaxService,
  ) {}

  async createChat(creatorId: string, workspaceId: string) {
    const id = uuidv7();
    await this.db
      .insertInto('aiChats')
      .values({
        id,
        creatorId,
        workspaceId,
      } as any)
      .execute();

    return this.getChatById(id);
  }

  async getChatById(chatId: string) {
    const chat = await this.db
      .selectFrom('aiChats')
      .selectAll()
      .where('id', '=', chatId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    return chat || null;
  }

  async listChats(creatorId: string, workspaceId: string, limit = 30, cursor?: string) {
    let query = this.db
      .selectFrom('aiChats')
      .selectAll()
      .where('creatorId', '=', creatorId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);

    if (cursor) {
      query = query.where('createdAt', '<', new Date(cursor));
    }

    const results = await query.execute();
    const hasNextPage = results.length > limit;

    if (hasNextPage) results.pop();

    return {
      data: results,
      meta: {
        hasNextPage,
        nextCursor: hasNextPage ? results[results.length - 1].createdAt.toISOString() : null,
      },
    };
  }

  async getChatInfo(chatId: string) {
    const chat = await this.getChatById(chatId);
    if (!chat) throw new NotFoundException('Chat not found');

    const messages = await this.db
      .selectFrom('aiChatMessages')
      .select(['id', 'chatId', 'role', 'content', 'createdAt'])
      .where('chatId', '=', chatId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'asc')
      .execute();

    return { chat, messages };
  }

  async deleteChat(chatId: string) {
    await this.db
      .updateTable('aiChats')
      .set({ deletedAt: new Date() } as any)
      .where('id', '=', chatId)
      .execute();
  }

  async updateChatTitle(chatId: string, title: string) {
    const chat = await this.getChatById(chatId);
    if (!chat) throw new NotFoundException('Chat not found');

    await this.db
      .updateTable('aiChats')
      .set({ title, updatedAt: new Date() } as any)
      .where('id', '=', chatId)
      .execute();

    return this.getChatById(chatId);
  }

  async searchChats(query: string, userId: string, workspaceId: string) {
    const searchTerm = query.trim().toLowerCase();

    return this.db
      .selectFrom('aiChats')
      .selectAll()
      .where('creatorId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .where((eb) =>
        eb(sql`LOWER(title)`, 'like', `%${searchTerm}%`),
      )
      .orderBy('createdAt', 'desc')
      .limit(20)
      .execute();
  }

  async saveMessage(
    chatId: string,
    workspaceId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string,
  ) {
    const id = uuidv7();
    await this.db
      .insertInto('aiChatMessages')
      .values({
        id,
        chatId,
        workspaceId,
        userId,
        role,
        content,
      } as any)
      .execute();
    return id;
  }

  async updateChatTimestamp(chatId: string) {
    await this.db
      .updateTable('aiChats')
      .set({ updatedAt: new Date() } as any)
      .where('id', '=', chatId)
      .execute();
  }

  async getChatHistory(chatId: string) {
    const messages = await this.db
      .selectFrom('aiChatMessages')
      .select(['role', 'content'])
      .where('chatId', '=', chatId)
      .where('deletedAt', 'is', null)
      .where('role', 'in', ['user', 'assistant'])
      .orderBy('createdAt', 'asc')
      .execute();

    return messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content || '',
    }));
  }
}
