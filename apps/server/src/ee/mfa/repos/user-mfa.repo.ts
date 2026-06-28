import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertableUserMFA,
  UpdatableUserMFA,
  UserMFA,
} from '@docmost/db/types/entity.types';

@Injectable()
export class UserMfaRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByUserId(userId: string): Promise<UserMFA | undefined> {
    return this.db
      .selectFrom('userMfa')
      .selectAll()
      .where('userId', '=', userId)
      .executeTakeFirst();
  }

  async upsert(
    data: InsertableUserMFA,
    trx?: KyselyTransaction,
  ): Promise<UserMFA> {
    const db = dbOrTx(this.db, trx);
    const existing = await this.findByUserId(data.userId);

    if (existing) {
      return db
        .updateTable('userMfa')
        .set({ ...data, updatedAt: new Date() })
        .where('userId', '=', data.userId)
        .returningAll()
        .executeTakeFirst();
    }

    return db
      .insertInto('userMfa')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async update(
    userId: string,
    data: UpdatableUserMFA,
    trx?: KyselyTransaction,
  ): Promise<UserMFA> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('userMfa')
      .set({ ...data, updatedAt: new Date() })
      .where('userId', '=', userId)
      .returningAll()
      .executeTakeFirst();
  }
}
