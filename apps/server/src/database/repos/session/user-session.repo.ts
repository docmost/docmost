import {
  InsertableUserSession,
  UserSession,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';

@Injectable()
export class UserSessionRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insertSession(
    session: InsertableUserSession,
    trx?: KyselyTransaction,
  ): Promise<UserSession> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('userSessions')
      .values(session)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findActiveById(id: string): Promise<UserSession | undefined> {
    return this.db
      .selectFrom('userSessions')
      .selectAll()
      .where('id', '=', id)
      .where('expiresAt', '>', new Date())
      .where('revokedAt', 'is', null)
      .executeTakeFirst();
  }

  async findActiveByUser(
    userId: string,
    workspaceId: string,
  ): Promise<UserSession[]> {
    return this.db
      .selectFrom('userSessions')
      .selectAll()
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('expiresAt', '>', new Date())
      .where('revokedAt', 'is', null)
      .orderBy('lastActiveAt', 'desc')
      .execute();
  }

  async updateLastActiveAt(id: string): Promise<void> {
    await this.db
      .updateTable('userSessions')
      .set({ lastActiveAt: new Date() })
      .where('id', '=', id)
      .execute();
  }

  async revokeById(
    id: string,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .updateTable('userSessions')
      .set({ revokedAt: new Date() })
      .where('id', '=', id)
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('revokedAt', 'is', null)
      .execute();
  }

  async revokeAllExceptCurrent(
    currentSessionId: string,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .updateTable('userSessions')
      .set({ revokedAt: new Date() })
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('id', '!=', currentSessionId)
      .where('revokedAt', 'is', null)
      .execute();
  }

  async revokeByUserId(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .updateTable('userSessions')
      .set({ revokedAt: new Date() })
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('revokedAt', 'is', null)
      .execute();
  }

  async deleteByUserId(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .deleteFrom('userSessions')
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async deleteAllExceptCurrent(
    currentSessionId: string,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .deleteFrom('userSessions')
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('id', '!=', currentSessionId)
      .execute();
  }
}
