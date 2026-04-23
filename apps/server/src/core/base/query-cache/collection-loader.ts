import { Injectable, Logger } from '@nestjs/common';
import { DuckDBInstance } from '@duckdb/node-api';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { buildColumnSpecs } from './column-types';
import { buildLoaderSql } from './loader-sql';
import { LoadedCollection } from './query-cache.types';
import { PostgresExtensionService } from './postgres-extension.service';
import { QueryCacheConfigProvider } from './query-cache.config';

@Injectable()
export class CollectionLoader {
  private readonly logger = new Logger(CollectionLoader.name);

  constructor(
    private readonly baseRepo: BaseRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly pgExtension: PostgresExtensionService,
    private readonly config: QueryCacheConfigProvider,
  ) {}

  async load(baseId: string, workspaceId: string): Promise<LoadedCollection> {
    if (!this.pgExtension.isReady()) {
      throw new Error(
        `Cannot load collection ${baseId}: postgres extension not ready. ` +
          'Check PostgresExtensionService bootstrap logs.',
      );
    }

    const base = await this.baseRepo.findById(baseId);
    if (!base) {
      throw new Error(`Base ${baseId} not found`);
    }
    const schemaVersion = (base as any).schemaVersion ?? 1;

    const properties = await this.basePropertyRepo.findByBaseId(baseId);
    const specs = buildColumnSpecs(properties);

    const { memoryLimit, threads, tempDirectory } = this.config.config;

    // Ensure the temp directory exists so DuckDB can spill to it.
    // Swallow errors — if creation fails, DuckDB will fail its own sanity
    // check and we'll log that instead of crashing here.
    try {
      const fs = require('node:fs');
      fs.mkdirSync(tempDirectory, { recursive: true });
    } catch {
      /* swallow */
    }

    const instance = await DuckDBInstance.create(':memory:', {
      memory_limit: memoryLimit,
      threads: String(threads),
      temp_directory: tempDirectory,
    });
    const connection = await instance.connect();

    try {
      await this.pgExtension.configureOnConnection(connection);

      // Disable insertion-order preservation during bulk load — DuckDB's docs
      // explicitly recommend this for memory-pressure on large inserts. Our
      // loader doesn't depend on the insertion order (we sort via indexes
      // or keyset cursors later), so this is free memory savings.
      await connection.run('SET preserve_insertion_order = false');

      // Bulk load via CREATE TABLE AS SELECT. JSONB extraction happens
      // server-side via the base_cell_* helpers; DuckDB streams typed
      // columns over COPY BINARY into its vectorized insert path.
      const sql = buildLoaderSql(specs, baseId, workspaceId);
      if (this.config.config.trace) {
        console.log(
          '[cache-trace]',
          JSON.stringify({
            phase: 'loader.sql',
            baseId,
            length: sql.length,
            sql,
          }),
        );
      }
      await connection.run(sql);

      // Release the PG connection held by the ATTACH — we're done with
      // Postgres; all subsequent queries run purely against the local table.
      await this.pgExtension.detach(connection);

      // Build ART indexes on indexable columns.
      for (const spec of specs) {
        if (!spec.indexable) continue;
        const safe = spec.column.replace(/[^a-zA-Z0-9_]/g, '_');
        const tIdx = this.config.config.trace ? Date.now() : 0;
        await connection.run(
          `CREATE INDEX ${quoteIdent(`idx_${safe}`)} ON rows (${quoteIdent(spec.column)})`,
        );
        if (this.config.config.trace) {
          console.log(
            '[cache-trace]',
            JSON.stringify({
              phase: 'loader.index',
              baseId,
              column: spec.column,
              ms: Date.now() - tIdx,
            }),
          );
        }
      }

      const countResult = await connection.runAndReadAll(
        'SELECT count(*) AS c FROM rows',
      );
      const rowCount = Number(
        (countResult.getRowObjects()[0] as { c: bigint | number }).c,
      );

      const memoryResult = await connection.runAndReadAll(
        `SELECT
           COALESCE(sum(memory_usage_bytes), 0)::BIGINT AS used_bytes,
           COALESCE(sum(temporary_storage_bytes), 0)::BIGINT AS spilled_bytes
         FROM duckdb_memory()`,
      );
      const mem = memoryResult.getRowObjects()[0] as {
        used_bytes: bigint | number;
        spilled_bytes: bigint | number;
      };
      const heapBytes = Number(mem.used_bytes);
      const spilledBytes = Number(mem.spilled_bytes);

      this.logger.debug(
        `Loaded ${rowCount} rows for base ${baseId} ` +
          `(schemaVersion=${schemaVersion}, heap=${fmtMb(heapBytes)}MB, spilled=${fmtMb(spilledBytes)}MB)`,
      );

      return {
        baseId,
        schemaVersion,
        columns: specs,
        instance,
        connection,
        lastAccessedAt: Date.now(),
        rowCount,
        heapBytes,
        spilledBytes,
      };
    } catch (err) {
      try {
        await this.pgExtension.detach(connection);
      } catch {
        /* swallow */
      }
      try {
        connection.closeSync();
      } catch {
        /* swallow */
      }
      try {
        instance.closeSync();
      } catch {
        /* swallow */
      }
      throw err;
    }
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function fmtMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
