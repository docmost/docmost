import { DuckDbRuntime } from './duckdb-runtime';
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
      memoryLimit: '256MB',
      threads: 2,
      tempDirectory: `${require('node:os').tmpdir()}/docmost-duckdb-runtime-test`,
      trace: false,
      readerPoolSize: 2,
      ...overrides,
    },
  }) as unknown as QueryCacheConfigProvider;

const makeEnv = (): { getDatabaseURL: () => string } => ({
  getDatabaseURL: () => process.env.DATABASE_URL ?? '',
});

describe('DuckDbRuntime', () => {
  it('no-ops when the cache is disabled', async () => {
    const rt = new DuckDbRuntime(makeConfig({ enabled: false }), makeEnv() as any);
    await rt.onApplicationBootstrap();
    expect(rt.isReady()).toBe(false);
    await rt.onModuleDestroy();
  });

  it('bootstraps instance, extension, PG attach, and reader pool', async () => {
    const rt = new DuckDbRuntime(makeConfig(), makeEnv() as any);
    await rt.onApplicationBootstrap();
    expect(rt.isReady()).toBe(true);
    expect(rt.readerPoolSize()).toBe(2);
    await rt.onModuleDestroy();
  });

  it('attachBase creates a per-base schema and detachBase removes it', async () => {
    const rt = new DuckDbRuntime(makeConfig(), makeEnv() as any);
    await rt.onApplicationBootstrap();
    try {
      const schema = 'b_testaaaaaaaaaaaaaaaaaaaaaaaaaa';
      await rt.attachBase(schema);
      await rt.getWriter().run(`CREATE TABLE ${schema}.t (x INTEGER)`);
      await rt.getWriter().run(`INSERT INTO ${schema}.t VALUES (1), (2), (3)`);
      const res = await rt
        .getWriter()
        .runAndReadAll(`SELECT count(*) AS c FROM ${schema}.t`);
      const row = res.getRowObjects()[0] as { c: bigint | number };
      expect(Number(row.c)).toBe(3);

      await rt.detachBase(schema);
      await expect(
        rt.getWriter().run(`SELECT count(*) FROM ${schema}.t`),
      ).rejects.toThrow();
    } finally {
      await rt.onModuleDestroy();
    }
  });

  it('withReader parallelises across pool', async () => {
    const rt = new DuckDbRuntime(makeConfig({ readerPoolSize: 2 }), makeEnv() as any);
    await rt.onApplicationBootstrap();
    try {
      const started: string[] = [];
      const ended: string[] = [];
      const p1 = rt.withReader(async (conn) => {
        started.push('a');
        await new Promise((r) => setTimeout(r, 50));
        await conn.runAndReadAll('SELECT 1');
        ended.push('a');
      });
      const p2 = rt.withReader(async (conn) => {
        started.push('b');
        await new Promise((r) => setTimeout(r, 50));
        await conn.runAndReadAll('SELECT 1');
        ended.push('b');
      });
      await Promise.all([p1, p2]);
      expect(new Set(started)).toEqual(new Set(['a', 'b']));
      expect(started.length).toBe(2);
      expect(ended.length).toBe(2);
    } finally {
      await rt.onModuleDestroy();
    }
  });

  it('withReader on a 3rd concurrent request with pool=2 queues correctly', async () => {
    const rt = new DuckDbRuntime(makeConfig({ readerPoolSize: 2 }), makeEnv() as any);
    await rt.onApplicationBootstrap();
    try {
      const order: number[] = [];
      const makeOne = (n: number, delayMs: number) =>
        rt.withReader(async () => {
          await new Promise((r) => setTimeout(r, delayMs));
          order.push(n);
        });
      const p1 = makeOne(1, 40);
      const p2 = makeOne(2, 40);
      const p3 = makeOne(3, 5);
      await Promise.all([p1, p2, p3]);
      expect(order.length).toBe(3);
      expect(order.indexOf(3)).toBeGreaterThan(0);
    } finally {
      await rt.onModuleDestroy();
    }
  });

  it('getWriter throws if not ready', () => {
    const rt = new DuckDbRuntime(makeConfig(), makeEnv() as any);
    expect(() => rt.getWriter()).toThrow(/not ready/i);
  });
});
