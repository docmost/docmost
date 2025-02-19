import {
  Backlink,
  InsertableBacklink,
  UpdatableBacklink,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';

@Injectable()
export class BacklinkRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    backlinkId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<Backlink> {
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('backlinks')
      .select([
        'id',
        'sourcePageId',
        'targetPageId',
        'workspaceId',
        'createdAt',
        'updatedAt',
      ])
      .where('id', '=', backlinkId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async insertBacklink(
    insertableBacklink: InsertableBacklink,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('backlinks')
      .values(insertableBacklink)
      .onConflict((oc) =>
        oc.columns(['sourcePageId', 'targetPageId']).doNothing(),
      )
      .returningAll()
      .executeTakeFirst();
  }

  async updateBacklink(
    updatableBacklink: UpdatableBacklink,
    backlinkId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('userTokens')
      .set(updatableBacklink)
      .where('id', '=', backlinkId)
      .execute();
  }

  async deleteBacklink(
    backlinkId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('backlinks').where('id', '=', backlinkId).execute();
  }
}
