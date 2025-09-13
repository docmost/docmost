import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { AuthAccounts } from '@docmost/db/types/db';
import { dbOrTx } from '@docmost/db/utils';
import { InsertableAuthAccount, UpdatableAuthAccount, AuthAccount } from '@docmost/db/types/entity.types';

@Injectable()
export class AuthAccountRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  public baseFields: Array<keyof AuthAccounts> = [
    'id',
    'userId',
    'providerUserId',
    'authProviderId',
    'workspaceId',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  async findByUserAndProvider(
    userId: string,
    authProviderId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthAccount | null> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authAccounts')
      .select(this.baseFields)
      .where('userId', '=', userId)
      .where('authProviderId', '=', authProviderId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByProviderUserId(
    providerUserId: string,
    authProviderId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthAccount | null> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authAccounts')
      .select(this.baseFields)
      .where('providerUserId', '=', providerUserId)
      .where('authProviderId', '=', authProviderId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async create(data: InsertableAuthAccount, trx?: KyselyTransaction): Promise<AuthAccount> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('authAccounts')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(id: string, data: UpdatableAuthAccount, trx?: KyselyTransaction): Promise<AuthAccount> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('authAccounts')
      .set(data)
      .where('id', '=', id)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(id: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('authAccounts')
      .set({ deletedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }

  async findByUserId(userId: string, workspaceId: string, trx?: KyselyTransaction): Promise<AuthAccount[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authAccounts')
      .select(this.baseFields)
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }
}
