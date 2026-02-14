import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  AuthAccount,
  InsertableAuthAccount,
} from '@docmost/db/types/entity.types';

@Injectable()
export class AuthAccountRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByProviderUserId(
    providerUserId: string,
    authProviderId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthAccount> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authAccounts')
      .selectAll()
      .where('providerUserId', '=', providerUserId)
      .where('authProviderId', '=', authProviderId)
      .executeTakeFirst();
  }

  async findByUserId(
    userId: string,
    authProviderId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthAccount> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authAccounts')
      .selectAll()
      .where('userId', '=', userId)
      .where('authProviderId', '=', authProviderId)
      .executeTakeFirst();
  }

  async insert(
    insertable: InsertableAuthAccount,
    trx?: KyselyTransaction,
  ): Promise<AuthAccount> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('authAccounts')
      .values(insertable)
      .returningAll()
      .executeTakeFirst();
  }

  async upsert(
    insertable: InsertableAuthAccount,
    trx?: KyselyTransaction,
  ): Promise<AuthAccount> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('authAccounts')
      .values(insertable)
      .onConflict((oc) =>
        oc
          .columns(['userId', 'authProviderId'])
          .doUpdateSet({ updatedAt: new Date() }),
      )
      .returningAll()
      .executeTakeFirst();
  }
}
