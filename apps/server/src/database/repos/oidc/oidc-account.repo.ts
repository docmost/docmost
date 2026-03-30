import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  AuthAccount,
  InsertableAuthAccount,
  UpdatableAuthAccount,
} from '@docmost/db/types/entity.types';

@Injectable()
export class OidcAccountRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private readonly baseFields = [
    'id',
    'workspaceId',
    'userId',
    'authProviderId',
    'providerUserId',
    'providerEmail',
    'metadata',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ] as const;

  async findByProviderUserId(
    workspaceId: string,
    authProviderId: string,
    providerUserId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthAccount> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authAccounts')
      .select(this.baseFields)
      .where('workspaceId', '=', workspaceId)
      .where('authProviderId', '=', authProviderId)
      .where('providerUserId', '=', providerUserId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByUserAndProvider(
    userId: string,
    authProviderId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthAccount> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authAccounts')
      .select(this.baseFields)
      .where('userId', '=', userId)
      .where('authProviderId', '=', authProviderId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async insertAccount(
    insertableAuthAccount: InsertableAuthAccount,
    trx?: KyselyTransaction,
  ): Promise<AuthAccount> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('authAccounts')
      .values(insertableAuthAccount)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async updateAccount(
    authAccountId: string,
    updatableAuthAccount: UpdatableAuthAccount,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('authAccounts')
      .set({ ...updatableAuthAccount, updatedAt: new Date() })
      .where('id', '=', authAccountId)
      .execute();
  }
}
