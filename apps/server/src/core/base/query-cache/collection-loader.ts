import { Injectable, Logger } from '@nestjs/common';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { buildColumnSpecs } from './column-types';
import { buildLoaderSql } from './loader-sql';
import { baseSchemaName } from './schema-name';
import { DuckDbRuntime } from './duckdb-runtime';
import { QueryCacheConfigProvider } from './query-cache.config';
import { LoadedCollection } from './query-cache.types';

/*
 * Loads a base into the shared DuckDB runtime as an attached in-memory
 * database (`<schema>.rows`). Steps:
 *
 *   1. Attach a per-base schema.
 *   2. Run `CREATE TABLE <schema>.rows AS SELECT ... FROM postgres_query(...)`
 *      via the writer connection — Postgres does the JSONB extraction.
 *   3. Declare `PRIMARY KEY (id)` on the new table.
 *   4. Build ART indexes on every indexable column.
 *   5. Count rows and return a LoadedCollection metadata record.
 *
 * Error path: detach the schema before propagating the error, so we don't
 * leak an empty attached DB into the runtime.
 */
@Injectable()
export class CollectionLoader {
  private readonly logger = new Logger(CollectionLoader.name);

  constructor(
    private readonly baseRepo: BaseRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly runtime: DuckDbRuntime,
    private readonly config: QueryCacheConfigProvider,
  ) {}

  async load(baseId: string, workspaceId: string): Promise<LoadedCollection> {
    if (!this.runtime.isReady()) {
      throw new Error(
        `Cannot load collection ${baseId}: duckdb runtime not ready. ` +
          `Check DuckDbRuntime bootstrap logs.`,
      );
    }

    const base = await this.baseRepo.findById(baseId);
    if (!base) throw new Error(`Base ${baseId} not found`);
    const schemaVersion = (base as any).schemaVersion ?? 1;

    const properties = await this.basePropertyRepo.findByBaseId(baseId);
    const specs = buildColumnSpecs(properties);
    const schema = baseSchemaName(baseId);

    await this.runtime.attachBase(schema);

    try {
      const writer = this.runtime.getWriter();

      const sql = buildLoaderSql(specs, baseId, workspaceId, schema);
      if (this.config.config.trace) {
        console.log(
          '[cache-trace]',
          JSON.stringify({
            phase: 'loader.sql',
            baseId,
            schema,
            length: sql.length,
            sql,
          }),
        );
      }
      await writer.run(sql);

      await writer.run(`ALTER TABLE ${schema}.rows ADD PRIMARY KEY (id)`);

      for (const spec of specs) {
        if (!spec.indexable) continue;
        const safe = spec.column.replace(/[^a-zA-Z0-9_]/g, '_');
        const tIdx = this.config.config.trace ? Date.now() : 0;
        await writer.run(
          `CREATE INDEX ${schema}_${safe}_idx ON ${schema}.rows (${quoteIdent(spec.column)})`,
        );
        if (this.config.config.trace) {
          console.log(
            '[cache-trace]',
            JSON.stringify({
              phase: 'loader.index',
              baseId,
              schema,
              column: spec.column,
              ms: Date.now() - tIdx,
            }),
          );
        }
      }

      const countResult = await writer.runAndReadAll(
        `SELECT count(*) AS c FROM ${schema}.rows`,
      );
      const rowCount = Number(
        (countResult.getRowObjects()[0] as { c: bigint | number }).c,
      );

      const approxBytes = estimateBytes(rowCount, specs.length);

      this.logger.debug(
        `Loaded ${rowCount} rows for base ${baseId} ` +
          `(schemaVersion=${schemaVersion}, schema=${schema}, approxMB=${fmtMb(approxBytes)})`,
      );

      return {
        baseId,
        schema,
        schemaVersion,
        columns: specs,
        lastAccessedAt: Date.now(),
        rowCount,
        approxBytes,
      };
    } catch (err) {
      try {
        await this.runtime.detachBase(schema);
      } catch { /* swallow */ }
      throw err;
    }
  }
}

function estimateBytes(rowCount: number, columnCount: number): number {
  // Rough heuristic: ~64 bytes per cell (typed value + ART index entry
  // overhead). Within 2x of actual for typical schemas; used for
  // reporting only, not for eviction decisions.
  return rowCount * columnCount * 64;
}

function fmtMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
