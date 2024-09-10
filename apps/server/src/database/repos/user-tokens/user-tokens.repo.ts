import {
  InsertableUserToken,
  UpdatableUserToken,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';

@Injectable()
export class UserTokensRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

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
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('userTokens')
      .select([
        'id',
        'token',
        'user_id',
        'workspace_id',
        'type',
        'expires_at',
        'used_at',
        'created_at',
      ])
      .where('user_id', '=', userId)
      .where('workspace_id', '=', workspaceId)
      .where('type', '=', tokenType)
      .orderBy('expires_at desc')
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
      .set({ ...updatableUserToken })
      .where('id', '=', userTokenId)
      .execute();
  }

  async deleteUserToken(
    userId: string,
    workspaceId: string,
    tokenType: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .deleteFrom('userTokens')
      .where('user_id', '=', userId)
      .where('workspace_id', '=', workspaceId)
      .where('type', '=', tokenType)
      .execute();
  }

  async deleteExpiredUserTokens(
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .deleteFrom('userTokens')
      .where('expires_at', '<', new Date())
      .execute(); 
  }
}
