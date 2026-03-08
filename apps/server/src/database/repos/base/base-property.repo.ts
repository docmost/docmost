import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  BaseProperty,
  InsertableBaseProperty,
  UpdatableBaseProperty,
} from '@docmost/db/types/entity.types';
import { sql } from 'kysely';

@Injectable()
export class BasePropertyRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    propertyId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<BaseProperty | undefined> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .selectFrom('baseProperties')
      .selectAll()
      .where('id', '=', propertyId)
      .executeTakeFirst() as Promise<BaseProperty | undefined>;
  }

  async findByBaseId(
    baseId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<BaseProperty[]> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .selectFrom('baseProperties')
      .selectAll()
      .where('baseId', '=', baseId)
      .orderBy('position', 'asc')
      .execute() as Promise<BaseProperty[]>;
  }

  async getLastPosition(
    baseId: string,
    trx?: KyselyTransaction,
  ): Promise<string | null> {
    const db = dbOrTx(this.db, trx);
    const result = await db
      .selectFrom('baseProperties')
      .select('position')
      .where('baseId', '=', baseId)
      .orderBy(sql`position COLLATE "C"`, sql`DESC`)
      .limit(1)
      .executeTakeFirst();
    return result?.position ?? null;
  }

  async insertProperty(
    property: InsertableBaseProperty,
    trx?: KyselyTransaction,
  ): Promise<BaseProperty> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('baseProperties')
      .values(property)
      .returningAll()
      .executeTakeFirstOrThrow() as Promise<BaseProperty>;
  }

  async updateProperty(
    propertyId: string,
    data: UpdatableBaseProperty,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseProperties')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', propertyId)
      .execute();
  }

  async deleteProperty(
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('baseProperties')
      .where('id', '=', propertyId)
      .execute();
  }
}
