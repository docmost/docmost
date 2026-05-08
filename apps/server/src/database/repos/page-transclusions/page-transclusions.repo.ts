import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertablePageTransclusion,
  PageTransclusion,
  UpdatablePageTransclusion,
} from '@docmost/db/types/entity.types';

@Injectable()
export class PageTransclusionsRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByPageId(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<PageTransclusion[]> {
    return dbOrTx(this.db, trx)
      .selectFrom('pageTransclusions')
      .selectAll()
      .where('pageId', '=', pageId)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  async findByPageAndTransclusion(
    pageId: string,
    transclusionId: string,
    trx?: KyselyTransaction,
  ): Promise<PageTransclusion | undefined> {
    return dbOrTx(this.db, trx)
      .selectFrom('pageTransclusions')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('transclusionId', '=', transclusionId)
      .executeTakeFirst();
  }

  async findManyByPageAndTransclusion(
    keys: Array<{ pageId: string; transclusionId: string }>,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<PageTransclusion[]> {
    if (keys.length === 0) return [];
    return dbOrTx(this.db, trx)
      .selectFrom('pageTransclusions')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where((eb) =>
        eb.or(
          keys.map((k) =>
            eb.and([
              eb('pageId', '=', k.pageId),
              eb('transclusionId', '=', k.transclusionId),
            ]),
          ),
        ),
      )
      .execute();
  }

  async insert(
    data: InsertablePageTransclusion,
    trx?: KyselyTransaction,
  ): Promise<PageTransclusion> {
    return dbOrTx(this.db, trx)
      .insertInto('pageTransclusions')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async insertMany(
    data: InsertablePageTransclusion[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (data.length === 0) return;
    await dbOrTx(this.db, trx)
      .insertInto('pageTransclusions')
      .values(data)
      .execute();
  }

  async update(
    pageId: string,
    transclusionId: string,
    data: UpdatablePageTransclusion,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await dbOrTx(this.db, trx)
      .updateTable('pageTransclusions')
      .set({ ...data, updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .where('transclusionId', '=', transclusionId)
      .execute();
  }

  async deleteByPageAndTransclusionIds(
    pageId: string,
    transclusionIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (transclusionIds.length === 0) return;
    await dbOrTx(this.db, trx)
      .deleteFrom('pageTransclusions')
      .where('pageId', '=', pageId)
      .where('transclusionId', 'in', transclusionIds)
      .execute();
  }

}
