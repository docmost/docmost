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
    opts?: { trx?: KyselyTransaction; includeDeleted?: boolean },
  ): Promise<BaseProperty | undefined> {
    const db = dbOrTx(this.db, opts?.trx);
    let qb = db
      .selectFrom('baseProperties')
      .selectAll()
      .where('id', '=', propertyId);
    if (!opts?.includeDeleted) qb = qb.where('deletedAt', 'is', null);
    return qb.executeTakeFirst() as Promise<BaseProperty | undefined>;
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
      .where('deletedAt', 'is', null)
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
      .orderBy(sql`position COLLATE "C"`, 'desc')
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

  async softDelete(
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseProperties')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', propertyId)
      .execute();
  }

  async hardDelete(
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('baseProperties')
      .where('id', '=', propertyId)
      .execute();
  }

  async bumpSchemaVersion(
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseProperties')
      .set({
        schemaVersion: sql`schema_version + 1`,
        updatedAt: new Date(),
      })
      .where('id', '=', propertyId)
      .execute();
  }

  /*
   * Promotes `pending_type` / `pending_type_options` onto the live `type` /
   * `type_options` columns and clears the pending pair. No-op if no
   * conversion was pending. Caller is responsible for doing this inside the
   * same transaction as the cell rewrite so readers never see a
   * half-converted state.
   */
  async commitPendingTypeChange(
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseProperties')
      .set({
        type: sql`coalesce(pending_type, type)`,
        typeOptions: sql`coalesce(pending_type_options, type_options)`,
        pendingType: null,
        pendingTypeOptions: null,
        updatedAt: new Date(),
      })
      .where('id', '=', propertyId)
      .execute();
  }

  async clearPendingTypeChange(
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseProperties')
      .set({
        pendingType: null,
        pendingTypeOptions: null,
        updatedAt: new Date(),
      })
      .where('id', '=', propertyId)
      .execute();
  }
}
