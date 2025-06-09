import {
  InsertableUserToken,
  UpdatableUserToken,
  UserToken,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';

@Injectable()
export class UserTokenRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    token: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<UserToken> {
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('userTokens')
      .select([
        'id',
        'token',
        'userId',
        'workspaceId',
        'type',
        'expiresAt',
        'usedAt',
        'createdAt',
      ])
      .where('token', '=', token)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async insertUserToken(
    insertableUserToken: InsertableUserToken,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('userTokens')
      .values(insertableUserToken)
      .returningAll()
      .executeTakeFirst();
  }

  async findByUserId(
    userId: string,
    workspaceId: string,
    tokenType: string,
    trx?: KyselyTransaction,
  ): Promise<UserToken[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('userTokens')
      .select([
        'id',
        'token',
        'userId',
        'workspaceId',
        'type',
        'expiresAt',
        'usedAt',
        'createdAt',
      ])
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('type', '=', tokenType)
      .orderBy('expiresAt', 'desc')
      .execute();
  }

  async updateUserToken(
    updatableUserToken: UpdatableUserToken,
    userTokenId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('userTokens')
      .set(updatableUserToken)
      .where('id', '=', userTokenId)
      .execute();
  }

  async deleteToken(token: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('userTokens').where('token', '=', token).execute();
  }

  async deleteExpiredUserTokens(trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('userTokens')
      .where('expiresAt', '<', new Date())
      .execute();
  }
}
