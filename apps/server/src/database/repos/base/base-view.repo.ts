import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  BaseView,
  InsertableBaseView,
  UpdatableBaseView,
} from '@docmost/db/types/entity.types';
import { sql } from 'kysely';

@Injectable()
export class BaseViewRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    viewId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<BaseView | undefined> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .selectFrom('baseViews')
      .selectAll()
      .where('id', '=', viewId)
      .executeTakeFirst() as Promise<BaseView | undefined>;
  }

  async findByBaseId(
    baseId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<BaseView[]> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .selectFrom('baseViews')
      .selectAll()
      .where('baseId', '=', baseId)
      .orderBy('position', 'asc')
      .execute() as Promise<BaseView[]>;
  }

  async countByBaseId(
    baseId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);
    const result = await db
      .selectFrom('baseViews')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('baseId', '=', baseId)
      .executeTakeFirstOrThrow();
    return Number(result.count);
  }

  async getLastPosition(
    baseId: string,
    trx?: KyselyTransaction,
  ): Promise<string | null> {
    const db = dbOrTx(this.db, trx);
    const result = await db
      .selectFrom('baseViews')
      .select('position')
      .where('baseId', '=', baseId)
      .orderBy(sql`position COLLATE "C"`, sql`DESC`)
      .limit(1)
      .executeTakeFirst();
    return result?.position ?? null;
  }

  async insertView(
    view: InsertableBaseView,
    trx?: KyselyTransaction,
  ): Promise<BaseView> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('baseViews')
      .values(view)
      .returningAll()
      .executeTakeFirstOrThrow() as Promise<BaseView>;
  }

  async updateView(
    viewId: string,
    data: UpdatableBaseView,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('baseViews')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', viewId)
      .execute();
  }

  async deleteView(
    viewId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('baseViews')
      .where('id', '=', viewId)
      .execute();
  }
}
