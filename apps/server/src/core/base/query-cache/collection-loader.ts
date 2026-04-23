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

    const { memoryLimit, threads } = this.config.config;
    const instance = await DuckDBInstance.create(':memory:', {
      memory_limit: memoryLimit,
      threads: String(threads),
    });
    const connection = await instance.connect();

    try {
      await this.pgExtension.configureOnConnection(connection);

      // Bulk load via CREATE TABLE AS SELECT. JSONB extraction happens
      // server-side via the base_cell_* helpers; DuckDB streams typed
      // columns over COPY BINARY into its vectorized insert path.
      const sql = buildLoaderSql(specs, baseId, workspaceId);
      await connection.run(sql);

      // Release the PG connection held by the ATTACH — we're done with
      // Postgres; all subsequent queries run purely against the local table.
      await this.pgExtension.detach(connection);

      // Build ART indexes on indexable columns.
      for (const spec of specs) {
        if (!spec.indexable) continue;
        const safe = spec.column.replace(/[^a-zA-Z0-9_]/g, '_');
        await connection.run(
          `CREATE INDEX ${quoteIdent(`idx_${safe}`)} ON rows (${quoteIdent(spec.column)})`,
        );
      }

      const countResult = await connection.runAndReadAll(
        'SELECT count(*) AS c FROM rows',
      );
      const rowCount = Number(
        (countResult.getRowObjects()[0] as { c: bigint | number }).c,
      );

      this.logger.debug(
        `Loaded ${rowCount} rows for base ${baseId} (schemaVersion=${schemaVersion})`,
      );

      return {
        baseId,
        schemaVersion,
        columns: specs,
        instance,
        connection,
        lastAccessedAt: Date.now(),
        rowCount,
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
