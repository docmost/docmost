import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertablePageTransclusionReference,
  PageTransclusionReference,
} from '@docmost/db/types/entity.types';

export type TransclusionReferenceKey = {
  sourcePageId: string;
  transclusionId: string;
};

@Injectable()
export class PageTransclusionReferencesRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByReferencePageId(
    referencePageId: string,
    trx?: KyselyTransaction,
  ): Promise<PageTransclusionReference[]> {
    return dbOrTx(this.db, trx)
      .selectFrom('pageTransclusionReferences')
      .selectAll()
      .where('referencePageId', '=', referencePageId)
      .execute();
  }

  async findReferencePageIdsByTransclusion(
    sourcePageId: string,
    transclusionId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    const rows = await dbOrTx(this.db, trx)
      .selectFrom('pageTransclusionReferences')
      .select('referencePageId')
      .distinct()
      .where('workspaceId', '=', workspaceId)
      .where('sourcePageId', '=', sourcePageId)
      .where('transclusionId', '=', transclusionId)
      .execute();
    return rows.map((r) => r.referencePageId);
  }

  async insertMany(
    rows: InsertablePageTransclusionReference[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (rows.length === 0) return;
    await dbOrTx(this.db, trx)
      .insertInto('pageTransclusionReferences')
      .values(rows)
      .onConflict((oc) =>
        oc
          .columns(['referencePageId', 'sourcePageId', 'transclusionId'])
          .doNothing(),
      )
      .execute();
  }

  async deleteByReferenceAndKeys(
    referencePageId: string,
    keys: TransclusionReferenceKey[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (keys.length === 0) return;
    await dbOrTx(this.db, trx)
      .deleteFrom('pageTransclusionReferences')
      .where('referencePageId', '=', referencePageId)
      .where((eb) =>
        eb.or(
          keys.map((k) =>
            eb.and([
              eb('sourcePageId', '=', k.sourcePageId),
              eb('transclusionId', '=', k.transclusionId),
            ]),
          ),
        ),
      )
      .execute();
  }

  async deleteOne(
    referencePageId: string,
    sourcePageId: string,
    transclusionId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await dbOrTx(this.db, trx)
      .deleteFrom('pageTransclusionReferences')
      .where('referencePageId', '=', referencePageId)
      .where('sourcePageId', '=', sourcePageId)
      .where('transclusionId', '=', transclusionId)
      .execute();
  }
}
