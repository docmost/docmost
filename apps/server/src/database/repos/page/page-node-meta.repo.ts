import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertablePageNodeMeta,
  PageNodeMeta,
  UpdatablePageNodeMeta,
} from '@docmost/db/types/entity.types';

export type PageNodeType = 'file' | 'folder';

@Injectable()
export class PageNodeMetaRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByPageId(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<PageNodeMeta | undefined> {
    return dbOrTx(this.db, trx)
      .selectFrom('pageNodeMeta')
      .selectAll()
      .where('pageId', '=', pageId)
      .executeTakeFirst();
  }

  async ensureMeta(
    data: InsertablePageNodeMeta,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await dbOrTx(this.db, trx)
      .insertInto('pageNodeMeta')
      .values(data)
      .onConflict((oc) => oc.column('pageId').doNothing())
      .execute();
  }

  async upsertMeta(
    data: InsertablePageNodeMeta,
    trx?: KyselyTransaction,
  ): Promise<PageNodeMeta | undefined> {
    return dbOrTx(this.db, trx)
      .insertInto('pageNodeMeta')
      .values(data)
      .onConflict((oc) =>
        oc.column('pageId').doUpdateSet({
          workspaceId: data.workspaceId,
          spaceId: data.spaceId,
          nodeType: data.nodeType,
          isPinned: data.isPinned,
          pinnedAt: data.pinnedAt ?? null,
          updatedAt: new Date(),
        }),
      )
      .returningAll()
      .executeTakeFirst();
  }

  async updateByPageId(
    pageId: string,
    data: UpdatablePageNodeMeta,
    trx?: KyselyTransaction,
  ): Promise<PageNodeMeta | undefined> {
    return dbOrTx(this.db, trx)
      .updateTable('pageNodeMeta')
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where('pageId', '=', pageId)
      .returningAll()
      .executeTakeFirst();
  }
}
