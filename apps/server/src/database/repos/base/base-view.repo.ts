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

type RepoOpts = { trx?: KyselyTransaction };
type WorkspaceOpts = { workspaceId: string } & RepoOpts;

@Injectable()
export class BaseViewRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    viewId: string,
    opts: WorkspaceOpts,
  ): Promise<BaseView | undefined> {
    const db = dbOrTx(this.db, opts.trx);
    return db
      .selectFrom('baseViews')
      .selectAll()
      .where('id', '=', viewId)
      .where('workspaceId', '=', opts.workspaceId)
      .executeTakeFirst() as Promise<BaseView | undefined>;
  }

  async findByBaseId(
    baseId: string,
    opts: WorkspaceOpts,
  ): Promise<BaseView[]> {
    const db = dbOrTx(this.db, opts.trx);
    return db
      .selectFrom('baseViews')
      .selectAll()
      .where('baseId', '=', baseId)
      .where('workspaceId', '=', opts.workspaceId)
      .orderBy('position', 'asc')
      .execute() as Promise<BaseView[]>;
  }

  async countByBaseId(
    baseId: string,
    opts: WorkspaceOpts,
  ): Promise<number> {
    const db = dbOrTx(this.db, opts.trx);
    const result = await db
      .selectFrom('baseViews')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('baseId', '=', baseId)
      .where('workspaceId', '=', opts.workspaceId)
      .executeTakeFirstOrThrow();
    return Number(result.count);
  }

  async getLastPosition(
    baseId: string,
    opts: WorkspaceOpts,
  ): Promise<string | null> {
    const db = dbOrTx(this.db, opts.trx);
    const result = await db
      .selectFrom('baseViews')
      .select('position')
      .where('baseId', '=', baseId)
      .where('workspaceId', '=', opts.workspaceId)
      .orderBy(sql`position COLLATE "C"`, 'desc')
      .limit(1)
      .executeTakeFirst();
    return result?.position ?? null;
  }

  async insertView(
    view: InsertableBaseView,
    opts?: RepoOpts,
  ): Promise<BaseView> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .insertInto('baseViews')
      .values(view)
      .returningAll()
      .executeTakeFirstOrThrow() as Promise<BaseView>;
  }

  async updateView(
    viewId: string,
    data: UpdatableBaseView,
    opts: WorkspaceOpts,
  ): Promise<void> {
    const db = dbOrTx(this.db, opts.trx);
    await db
      .updateTable('baseViews')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', viewId)
      .where('workspaceId', '=', opts.workspaceId)
      .execute();
  }

  async deleteView(
    viewId: string,
    opts: WorkspaceOpts,
  ): Promise<void> {
    const db = dbOrTx(this.db, opts.trx);
    await db
      .deleteFrom('baseViews')
      .where('id', '=', viewId)
      .where('workspaceId', '=', opts.workspaceId)
      .execute();
  }
}
