import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertablePageTransclusionReference,
  PageTransclusionReference,
} from '@docmost/db/types/entity.types';

export type TransclusionReferenceKey = {
  containingTransclusionId: string | null;
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
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    const rows = await dbOrTx(this.db, trx)
      .selectFrom('pageTransclusionReferences')
      .select('referencePageId')
      .distinct()
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
          .columns([
            'referencePageId',
            'containingTransclusionId',
            'sourcePageId',
            'transclusionId',
          ])
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
              k.containingTransclusionId === null
                ? eb('containingTransclusionId', 'is', null)
                : eb(
                    'containingTransclusionId',
                    '=',
                    k.containingTransclusionId,
                  ),
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

  async deleteByIds(ids: string[], trx?: KyselyTransaction): Promise<void> {
    if (ids.length === 0) return;
    await dbOrTx(this.db, trx)
      .deleteFrom('pageTransclusionReferences')
      .where('id', 'in', ids)
      .execute();
  }

  /**
   * Finds reference rows that participate in a cycle reachable from a given
   * source `(pageId, transclusionId)`. The walk follows source-to-source edges
   * (rows where `containing_transclusion_id IS NOT NULL`); loose page-level
   * references are not graph edges and are ignored.
   *
   * Returned rows are the *closing edges* — those whose insertion completed a
   * cycle. They are the safe set to remove to break the cycle while preserving
   * unrelated structure.
   */
  async findCyclicEdgesForSource(
    sourcePageId: string,
    transclusionId: string,
    trx?: KyselyTransaction,
  ): Promise<PageTransclusionReference[]> {
    const rows = await sql<PageTransclusionReference>`
      WITH RECURSIVE walk(
        start_page,
        start_id,
        page_id,
        transclusion_id,
        edge_id,
        is_cycle,
        path
      ) AS (
        SELECT
          ${sourcePageId}::uuid,
          ${transclusionId}::varchar,
          ${sourcePageId}::uuid,
          ${transclusionId}::varchar,
          NULL::uuid,
          false,
          ARRAY[(${sourcePageId}::uuid, ${transclusionId}::varchar)]
        UNION ALL
        SELECT
          w.start_page,
          w.start_id,
          r.source_page_id,
          r.transclusion_id,
          r.id,
          (r.source_page_id, r.transclusion_id) = ANY(w.path),
          w.path || ARRAY[(r.source_page_id, r.transclusion_id)]
        FROM page_transclusion_references r
        JOIN walk w
          ON r.reference_page_id = w.page_id
         AND r.containing_transclusion_id = w.transclusion_id
        WHERE r.containing_transclusion_id IS NOT NULL
          AND NOT w.is_cycle
      )
      SELECT
        r.id,
        r.created_at        AS "createdAt",
        r.reference_page_id  AS "referencePageId",
        r.containing_transclusion_id AS "containingTransclusionId",
        r.source_page_id     AS "sourcePageId",
        r.transclusion_id    AS "transclusionId"
      FROM walk w
      JOIN page_transclusion_references r ON r.id = w.edge_id
      WHERE w.is_cycle
    `.execute(dbOrTx(this.db, trx));
    return rows.rows;
  }
}
