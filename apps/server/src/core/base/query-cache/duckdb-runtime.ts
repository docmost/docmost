import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import * as fs from 'node:fs';
import { QueryCacheConfigProvider } from './query-cache.config';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { ConnectionPool } from './connection-pool';

/*
 * DuckDbRuntime
 * -------------
 * Owns the process-wide DuckDB instance and everything attached to it:
 *
 *   - One `DuckDBInstance` at `:memory:` with `memory_limit`, `threads`,
 *     `temp_directory` configured from env.
 *   - One writer `DuckDBConnection` for ATTACH/DETACH/CREATE TABLE/INSERT.
 *   - A pool of N reader connections for SELECTs; `withReader(fn)` lends
 *     one out, runs the callback, returns it — fair FIFO under contention.
 *   - The `postgres` extension is installed + loaded once, not per-base.
 *   - A single long-lived ATTACH against Postgres (READ_ONLY). All loaders
 *     reference `postgres_query('pg', $pgsql$ ... $pgsql$)` without doing
 *     their own attach/detach.
 *
 * When the query cache is disabled (`config.enabled === false`), the
 * runtime is a no-op: nothing is created, `isReady()` returns false, and
 * every consumer's own gate prevents it from touching the runtime.
 */
@Injectable()
export class DuckDbRuntime implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DuckDbRuntime.name);
  private instance: DuckDBInstance | null = null;
  private writer: DuckDBConnection | null = null;
  private readonly readerPool = new ConnectionPool<DuckDBConnection>();
  private readonly attachedSchemas = new Set<string>();
  private ready = false;
  private bootstrapFailure: string | null = null;

  constructor(
    private readonly configProvider: QueryCacheConfigProvider,
    private readonly env: EnvironmentService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const config = this.configProvider.config;
    if (!config.enabled) {
      this.logger.log('query cache disabled; skipping duckdb runtime bootstrap');
      return;
    }

    const dbUrl = this.env.getDatabaseURL();
    if (!dbUrl) {
      this.bootstrapFailure = 'DATABASE_URL is empty';
      this.logger.error('DuckDbRuntime cannot bootstrap: DATABASE_URL is empty');
      return;
    }

    try {
      fs.mkdirSync(config.tempDirectory, { recursive: true });
    } catch {
      /* swallow */
    }

    try {
      this.instance = await DuckDBInstance.create(':memory:', {
        memory_limit: config.memoryLimit,
        threads: String(config.threads),
        temp_directory: config.tempDirectory,
      });

      this.writer = await this.instance.connect();
      await this.writer.run('SET preserve_insertion_order = false');
      await this.writer.run('INSTALL postgres');
      await this.writer.run('LOAD postgres');
      await this.writer.run(
        `ATTACH ${escapeSqlString(dbUrl)} AS pg (TYPE POSTGRES, READ_ONLY)`,
      );

      const readers: DuckDBConnection[] = [];
      for (let i = 0; i < config.readerPoolSize; i++) {
        const reader = await this.instance.connect();
        await reader.run('SET preserve_insertion_order = false');
        readers.push(reader);
      }
      this.readerPool.init(readers);

      this.ready = true;
      this.logger.log(
        `DuckDbRuntime ready (readers=${config.readerPoolSize}, memory_limit=${config.memoryLimit})`,
      );
    } catch (err) {
      const error = err as Error;
      this.bootstrapFailure = error.message;
      this.logger.error(`DuckDbRuntime bootstrap failed: ${error.message}`);
      if (error.stack) this.logger.error(error.stack);
      this.ready = false;
      try {
        this.readerPool.close().forEach((c) => c.closeSync());
      } catch { /* swallow */ }
      try {
        this.writer?.closeSync();
      } catch { /* swallow */ }
      try {
        this.instance?.closeSync();
      } catch { /* swallow */ }
      this.writer = null;
      this.instance = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const c of this.readerPool.close()) {
      try {
        c.closeSync();
      } catch { /* swallow */ }
    }
    if (this.writer) {
      try {
        this.writer.closeSync();
      } catch { /* swallow */ }
      this.writer = null;
    }
    if (this.instance) {
      try {
        this.instance.closeSync();
      } catch { /* swallow */ }
      this.instance = null;
    }
    this.attachedSchemas.clear();
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready;
  }

  readerPoolSize(): number {
    return this.readerPool.size();
  }

  lastBootstrapFailure(): string | null {
    return this.bootstrapFailure;
  }

  /*
   * Attach a new in-memory database for a base. Idempotent: if the schema
   * is already attached, this is a no-op. Schema name must come from
   * `baseSchemaName()` — validated by the caller; we check shape here
   * as defense-in-depth.
   */
  async attachBase(schema: string): Promise<void> {
    this.requireReady();
    this.requireSchemaShape(schema);
    if (this.attachedSchemas.has(schema)) return;

    await this.writer!.run(`ATTACH ':memory:' AS ${schema}`);
    this.attachedSchemas.add(schema);
  }

  /*
   * Detach an in-memory database. Idempotent: detaching a non-attached
   * schema is a swallow. Frees all memory held by the attached DB back
   * to the shared buffer pool.
   */
  async detachBase(schema: string): Promise<void> {
    if (!this.ready || !this.writer) return;
    this.requireSchemaShape(schema);
    if (!this.attachedSchemas.has(schema)) return;

    try {
      await this.writer.run(`DETACH DATABASE ${schema}`);
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (!/not attached|does not exist|unknown database/i.test(msg)) {
        throw err;
      }
    } finally {
      this.attachedSchemas.delete(schema);
    }
  }

  getWriter(): DuckDBConnection {
    this.requireReady();
    return this.writer!;
  }

  async withReader<T>(fn: (conn: DuckDBConnection) => Promise<T>): Promise<T> {
    this.requireReady();
    return this.readerPool.withResource(fn);
  }

  private requireReady(): void {
    if (!this.ready || !this.writer) {
      const detail = this.bootstrapFailure ? `: ${this.bootstrapFailure}` : '';
      throw new Error(`DuckDbRuntime not ready${detail}`);
    }
  }

  private requireSchemaShape(schema: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
      throw new Error(`Invalid schema name "${schema}"`);
    }
  }
}

function escapeSqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
