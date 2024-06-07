import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertableWorkspace,
  UpdatableWorkspace,
  Workspace,
} from '@docmost/db/types/entity.types';
import { sql } from 'kysely';

@Injectable()
export class WorkspaceRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    workspaceId: string,
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<Workspace> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('workspaces')
      .selectAll()
      .where('id', '=', workspaceId)
      .executeTakeFirst();
  }

  async findFirst(): Promise<Workspace> {
    return await this.db
      .selectFrom('workspaces')
      .selectAll()
      .orderBy('createdAt asc')
      .limit(1)
      .executeTakeFirst();
  }

  async findByHostname(hostname: string): Promise<Workspace> {
    return await this.db
      .selectFrom('workspaces')
      .selectAll()
      .where(sql`LOWER(hostname)`, '=', sql`LOWER(${hostname})`)
      .executeTakeFirst();
  }

  async updateWorkspace(
    updatableWorkspace: UpdatableWorkspace,
    workspaceId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('workspaces')
      .set({ ...updatableWorkspace, updatedAt: new Date() })
      .where('id', '=', workspaceId)
      .execute();
  }

  async insertWorkspace(
    insertableWorkspace: InsertableWorkspace,
    trx?: KyselyTransaction,
  ): Promise<Workspace> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('workspaces')
      .values(insertableWorkspace)
      .returningAll()
      .executeTakeFirst();
  }

  async count(): Promise<number> {
    const { count } = await this.db
      .selectFrom('workspaces')
      .select((eb) => eb.fn.count('id').as('count'))
      .executeTakeFirst();
    return count as number;
  }
}
