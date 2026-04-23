import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { QueryCacheConfigProvider } from './query-cache.config';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

/*
 * Owns the lifecycle of DuckDB's `postgres` extension for the query-cache
 * module. Responsibilities:
 *
 *   1. Install the extension once per process at bootstrap. DuckDB caches the
 *      binary to `$HOME/.duckdb/extensions/...`; subsequent LOADs are offline.
 *      We use the default DuckDB install path (fetches from
 *      `extensions.duckdb.org`) — air-gapped bundling is a separate plan.
 *
 *   2. Configure a fresh DuckDBConnection so a caller can run a single bulk
 *      load query against Postgres via `CREATE TABLE AS SELECT ... FROM pg.*`.
 *      We ATTACH `pg` in READ_ONLY mode using the connection URI inline,
 *      scoped to the DuckDB instance, with no disk state.
 *
 *   3. DETACH on request so the underlying PG connection is released
 *      immediately after the load completes. Per-instance PG attachments are
 *      transient: held only during CREATE TABLE AS, never across queries.
 *
 * When the master query-cache flag is off, this service is a no-op. No
 * instance is created, no network call is made.
 */
@Injectable()
export class PostgresExtensionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PostgresExtensionService.name);
  private ready = false;

  constructor(
    private readonly config: QueryCacheConfigProvider,
    private readonly env: EnvironmentService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.config.enabled) {
      this.logger.log('query cache disabled; skipping postgres extension install');
      return;
    }

    const bootstrap = await DuckDBInstance.create(':memory:');
    const conn = await bootstrap.connect();
    try {
      // INSTALL writes to $HOME/.duckdb/extensions/<version>/<platform>/.
      // First ever boot: fetches from extensions.duckdb.org. Subsequent boots:
      // local-disk no-op.
      await conn.run('INSTALL postgres');
      await conn.run('LOAD postgres');
      this.ready = true;
      this.logger.log('postgres extension installed and loaded');
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to install/load postgres extension: ${error.message}`,
      );
      if (error.stack) this.logger.error(error.stack);
      // Do NOT rethrow. A failed extension install must not crash the whole
      // app: the cache service handles this by falling through to Postgres
      // when `isReady()` returns false (see `CollectionLoader.load`).
      this.ready = false;
    } finally {
      await conn.closeSync();
      await bootstrap.closeSync();
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  /*
   * Prepares a fresh DuckDBConnection for a bulk-load query against Postgres.
   * Must be paired with `detach()` once CREATE TABLE AS completes.
   *
   * Safe to call on a just-created instance: LOAD reads from the on-disk
   * extension cache populated at bootstrap (no network call).
   */
  async configureOnConnection(conn: DuckDBConnection): Promise<void> {
    if (!this.ready) {
      throw new Error(
        'PostgresExtensionService not ready — check bootstrap logs',
      );
    }

    const dbUrl = this.env.getDatabaseURL();
    if (!dbUrl) {
      throw new Error('DATABASE_URL is empty; cannot ATTACH from duckdb');
    }

    await conn.run('LOAD postgres');

    // DuckDB 1.5's `postgres` extension secret syntax expects discrete
    // HOST/PORT/etc. parameters and rejects the single CONNECTION_STRING
    // field. Passing the URI directly as ATTACH's first argument keeps the
    // connection details opaque here and still binds the attachment to this
    // DuckDB instance only. READ_ONLY guards against the loader accidentally
    // mutating Postgres.
    await conn.run(
      `ATTACH ${escapeSqlString(dbUrl)} AS pg (TYPE POSTGRES, READ_ONLY)`,
    );
  }

  /*
   * Releases the PG connection held by this DuckDBConnection's ATTACH.
   * Idempotent — safe to call repeatedly, swallows "not attached" errors.
   */
  async detach(conn: DuckDBConnection): Promise<void> {
    try {
      await conn.run('DETACH pg');
    } catch (err) {
      const msg = (err as Error).message ?? '';
      // DuckDB wording: "Failed to detach database with name \"pg\": database
      // not found". Also handle older "not attached" / catalog-error shapes.
      if (!/not attached|not found|does not exist|catalog|failed to detach/i.test(msg)) {
        throw err;
      }
    }
  }
}

function escapeSqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
