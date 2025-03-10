import {
  InsertablePasskey,
  User,
  UserPasskey,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';

@Injectable()
export class UserPasskeyRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insertPasskey(
    insertableUserPasskey: InsertablePasskey,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('userPasskeys')
      .values(insertableUserPasskey)
      .returningAll()
      .executeTakeFirst();
  }

  async findByUserId(
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<UserPasskey[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('userPasskeys')
      .select([
        'id',
        'publicKey',
        'userId',
        'credentialId',
        'createdAt',
      ])
      .where('userId', '=', userId)
      .execute();
  }

  async removePasskey(user: User, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('userPasskeys').where('userId', '=', user.id).execute();
  }
}
