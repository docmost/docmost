import {
  InsertableSynchronizedPage,
  SynchronizedPage,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';

@Injectable()
export class SynchronizedPageRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insert(page: InsertableSynchronizedPage, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);
    await db.insertInto('synchronizedPages').values(page).execute();
  }

  async findByReferencePageId(
    referencePageId: string,
    trx?: KyselyTransaction,
  ): Promise<SynchronizedPage> {
    const db = dbOrTx(this.db, trx);
    return await db
      .selectFrom('synchronizedPages')
      .where('referencePageId', '=', referencePageId)
      .selectAll()
      .executeTakeFirst();
  }

  async findAllRefsByOriginId(
    originId: string,
    trx?: KyselyTransaction,
  ): Promise<{ referencePageId: string }[]> {
    const db = dbOrTx(this.db, trx);
    return await db
      .selectFrom('synchronizedPages')
      .where('originPageId', '=', originId)
      .select(['referencePageId'])
      .execute();
  }
}
