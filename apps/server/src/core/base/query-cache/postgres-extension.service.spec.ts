import { DuckDBInstance } from '@duckdb/node-api';
import { PostgresExtensionService } from './postgres-extension.service';
import { QueryCacheConfigProvider } from './query-cache.config';

const makeConfig = (
  overrides: Partial<QueryCacheConfigProvider['config']> = {},
): QueryCacheConfigProvider =>
  ({
    config: {
      enabled: true,
      minRows: 25_000,
      maxCollections: 50,
      warmTopN: 50,
      memoryLimit: '64MB',
      threads: 2,
      ...overrides,
    },
  }) as unknown as QueryCacheConfigProvider;

const makeEnv = (
  overrides: { dbUrl?: string } = {},
): { getDatabaseURL: () => string } => ({
  getDatabaseURL: () => overrides.dbUrl ?? process.env.DATABASE_URL ?? '',
});

describe('PostgresExtensionService', () => {
  it('no-ops when the query cache is disabled', async () => {
    const svc = new PostgresExtensionService(
      makeConfig({ enabled: false }),
      makeEnv() as any,
    );
    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(svc.isReady()).toBe(false);
  });

  it('installs and loads the postgres extension on bootstrap when enabled', async () => {
    const svc = new PostgresExtensionService(makeConfig(), makeEnv() as any);
    // First run hits the network (extensions.duckdb.org). Subsequent runs read from cache.
    await svc.onApplicationBootstrap();
    expect(svc.isReady()).toBe(true);
  });

  it('configureOnConnection loads the extension and attaches pg in a fresh instance', async () => {
    const svc = new PostgresExtensionService(makeConfig(), makeEnv() as any);
    await svc.onApplicationBootstrap();

    const instance = await DuckDBInstance.create(':memory:');
    const conn = await instance.connect();
    try {
      await svc.configureOnConnection(conn);
      // Smoke-test: query any PG system table. DuckDB's postgres scanner
      // exposes PG catalog tables under the attached schema's pg_catalog.
      const res = await conn.runAndReadAll(
        'SELECT count(*) AS c FROM pg.pg_catalog.pg_database',
      );
      const row = res.getRowObjects()[0] as { c: bigint | number };
      expect(Number(row.c)).toBeGreaterThan(0);
      await svc.detach(conn);
    } finally {
      conn.closeSync();
      instance.closeSync();
    }
  });

  it('detach is idempotent', async () => {
    const svc = new PostgresExtensionService(makeConfig(), makeEnv() as any);
    await svc.onApplicationBootstrap();

    const instance = await DuckDBInstance.create(':memory:');
    const conn = await instance.connect();
    try {
      await svc.configureOnConnection(conn);
      await svc.detach(conn);
      await expect(svc.detach(conn)).resolves.toBeUndefined();
    } finally {
      conn.closeSync();
      instance.closeSync();
    }
  });

  it('configureOnConnection throws a clear error when bootstrap never ran', async () => {
    const svc = new PostgresExtensionService(makeConfig(), makeEnv() as any);
    // Intentionally NOT calling onApplicationBootstrap.
    const instance = await DuckDBInstance.create(':memory:');
    const conn = await instance.connect();
    try {
      await expect(svc.configureOnConnection(conn)).rejects.toThrow(/not ready/i);
    } finally {
      conn.closeSync();
      instance.closeSync();
    }
  });

  it('includes the bootstrap failure reason in the not-ready error', async () => {
    // Force bootstrap to fail by giving the service a broken DB URL so that
    // LOAD postgres still succeeds but something in the bootstrap path throws.
    // Simplest reliable failure: monkey-patch the service so its bootstrap
    // runs a SQL statement that cannot succeed. We accept a small amount of
    // test-only access by subclassing.

    class BreakingService extends PostgresExtensionService {
      async onApplicationBootstrap(): Promise<void> {
        // Call super to keep the gate logic, but sabotage inside by
        // running INSTALL on a closed connection via a try-wrapper that
        // throws synchronously and is captured by the parent catch.
        // Simplest approach: directly set the failure and leave ready=false.
        (this as any).ready = false;
        (this as any).bootstrapFailure = 'simulated boot failure XYZ';
      }
    }

    const svc = new BreakingService(
      makeConfig(),
      makeEnv() as any,
    );
    await svc.onApplicationBootstrap();

    const instance = await DuckDBInstance.create(':memory:');
    const conn = await instance.connect();
    try {
      await expect(svc.configureOnConnection(conn)).rejects.toThrow(
        /simulated boot failure XYZ/,
      );
    } finally {
      conn.closeSync();
      instance.closeSync();
    }
  });
});
