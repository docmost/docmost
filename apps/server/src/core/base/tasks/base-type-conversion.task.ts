import { Logger } from '@nestjs/common';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import {
  BasePropertyType,
  BasePropertyTypeValue,
  CellConversionContext,
  attemptCellConversion,
} from '../base.schemas';
import { IBaseTypeConversionJob } from '../../../integrations/queue/constants/queue.interface';

const logger = new Logger('BaseTypeConversionTask');

const CHUNK_SIZE = 1000;

/*
 * Handles the cell-rewrite side of a property type change on a base.
 * Runs per-chunk batched UPDATEs so Node RAM stays flat regardless of row
 * count. When the source type stores IDs (select / multiSelect / person /
 * file), it resolves to display values before writing — fixing the
 * `String(optionId)` bug that the old synchronous path produced.
 *
 * The `trx` option lets callers run the whole rewrite inside an outer
 * transaction. That matters for the inline path in `BasePropertyService`,
 * where the cell rewrite + `type` swap + `schema_version` bump must land
 * atomically so readers never observe cells written for a type that hasn't
 * flipped yet.
 */
export async function processBaseTypeConversion(
  db: KyselyDB,
  baseRowRepo: BaseRowRepo,
  data: IBaseTypeConversionJob,
  opts?: {
    progress?: (processed: number) => Promise<void> | void;
    trx?: KyselyTransaction;
  },
): Promise<{ converted: number; cleared: number; total: number }> {
  const {
    baseId,
    propertyId,
    workspaceId,
    fromType,
    toType,
    fromTypeOptions,
    clearMode,
    actorId,
  } = data;

  const progress = opts?.progress;
  const trx = opts?.trx;
  const queryDb = dbOrTx(db, trx);

  let total = 0;
  let converted = 0;
  let cleared = 0;

  // Only rows whose cell jsonb actually has this property key need
  // rewriting — everything else is already consistent with the new type
  // (empty value → empty value). Skips the full-table scan on bases
  // where the property was only ever set on a few rows.
  for await (const chunk of baseRowRepo.streamByBaseId(baseId, {
    workspaceId,
    chunkSize: CHUNK_SIZE,
    trx,
    withCellKey: propertyId,
  })) {
    const ctx = await buildCtx(
      queryDb,
      chunk,
      propertyId,
      fromType,
      fromTypeOptions,
    );
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

    for (const row of chunk) {
      const cells = (row.cells ?? {}) as Record<string, unknown>;
      if (!(propertyId in cells)) continue;
      total++;

      if (clearMode) {
        updates.push({ id: row.id, patch: { [propertyId]: null } });
        cleared++;
        continue;
      }

      const result = attemptCellConversion(
        fromType as BasePropertyTypeValue,
        toType as BasePropertyTypeValue,
        cells[propertyId],
        ctx,
      );
      if (result.converted) {
        converted++;
        updates.push({
          id: row.id,
          patch: { [propertyId]: result.value ?? null },
        });
      } else {
        cleared++;
        updates.push({ id: row.id, patch: { [propertyId]: null } });
      }
    }

    if (updates.length > 0) {
      await baseRowRepo.batchUpdateCells(updates, {
        baseId,
        workspaceId,
        actorId,
        trx,
      });
    }

    if (progress) await progress(total);
  }

  logger.log(
    `type-conversion ${fromType}→${toType} base=${baseId} prop=${propertyId} total=${total} converted=${converted} cleared=${cleared}`,
  );

  return { converted, cleared, total };
}

/*
 * Builds the resolution context for a chunk. For select/multiSelect the
 * choice map lives in the property's typeOptions (already in the job
 * payload). For person and file, we batch-query the IDs present in this
 * chunk.
 */
async function buildCtx(
  db: KyselyDB | KyselyTransaction,
  chunk: Array<{ cells: unknown }>,
  propertyId: string,
  fromType: string,
  fromTypeOptions: unknown,
): Promise<CellConversionContext> {
  const ctx: CellConversionContext = { fromTypeOptions };

  if (fromType === BasePropertyType.PERSON) {
    const ids = collectIds(chunk, propertyId);
    if (ids.size > 0) {
      const rows = await db
        .selectFrom('users')
        .select(['id', 'name', 'email'])
        .where('id', 'in', Array.from(ids))
        .execute();
      ctx.userNames = new Map(
        rows.map((u) => [u.id, u.name || u.email || '']),
      );
    }
  } else if (fromType === BasePropertyType.FILE) {
    const ids = collectFileIds(chunk, propertyId);
    if (ids.size > 0) {
      const rows = await db
        .selectFrom('attachments')
        .select(['id', 'fileName'])
        .where('id', 'in', Array.from(ids))
        .execute();
      ctx.attachmentNames = new Map(rows.map((a) => [a.id, a.fileName]));
    }
  } else if (fromType === BasePropertyType.PAGE) {
    const ids = collectIds(chunk, propertyId);
    if (ids.size > 0) {
      const rows = await db
        .selectFrom('pages')
        .select(['id', 'title'])
        .where('id', 'in', Array.from(ids))
        .execute();
      ctx.pageTitles = new Map(rows.map((p) => [p.id, p.title ?? '']));
    }
  }

  return ctx;
}

function collectIds(
  chunk: Array<{ cells: unknown }>,
  propertyId: string,
): Set<string> {
  const out = new Set<string>();
  for (const row of chunk) {
    const v = (row.cells as any)?.[propertyId];
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string' && item.length > 0) out.add(item);
      }
    } else if (typeof v === 'string' && v.length > 0) {
      out.add(v);
    }
  }
  return out;
}

function collectFileIds(
  chunk: Array<{ cells: unknown }>,
  propertyId: string,
): Set<string> {
  const out = new Set<string>();
  for (const row of chunk) {
    const v = (row.cells as any)?.[propertyId];
    if (!Array.isArray(v)) continue;
    for (const f of v) {
      if (typeof f === 'string' && f.length > 0) {
        out.add(f);
      } else if (f && typeof f === 'object' && typeof f.id === 'string') {
        out.add(f.id);
      }
    }
  }
  return out;
}
