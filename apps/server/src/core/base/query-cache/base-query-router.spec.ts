import { BaseQueryRouter } from './base-query-router';
import { QueryCacheConfigProvider } from './query-cache.config';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { FilterNode, SearchSpec, SortSpec } from '../engine';

type FakeConfig = { enabled: boolean; minRows: number };

function makeRouter(
  cfg: FakeConfig,
  count: number,
): { router: BaseQueryRouter; countSpy: jest.Mock } {
  const configProvider = {
    config: {
      enabled: cfg.enabled,
      minRows: cfg.minRows,
      maxCollections: 10,
      warmTopN: 0,
    },
  } as unknown as QueryCacheConfigProvider;

  const countSpy = jest.fn().mockResolvedValue(count);
  const baseRowRepo = { countActiveRows: countSpy } as unknown as BaseRowRepo;

  return {
    router: new BaseQueryRouter(configProvider, baseRowRepo),
    countSpy,
  };
}

const filter: FilterNode = {
  op: 'and',
  children: [
    {
      propertyId: 'p1',
      op: 'eq',
      value: 'foo',
    },
  ],
};

const sorts: SortSpec[] = [{ propertyId: 'p1', direction: 'asc' }];

const trgmSearch: SearchSpec = { query: 'hello', mode: 'trgm' };
const ftsSearch: SearchSpec = { query: 'hello', mode: 'fts' };

const baseArgs = {
  baseId: 'base-1',
  workspaceId: 'ws-1',
};

describe('BaseQueryRouter.decide', () => {
  it('returns postgres when flag is off', async () => {
    const { router, countSpy } = makeRouter(
      { enabled: false, minRows: 10 },
      1000,
    );
    const decision = await router.decide({ ...baseArgs, filter });
    expect(decision).toBe('postgres');
    expect(countSpy).not.toHaveBeenCalled();
  });

  it('returns postgres when row count < minRows', async () => {
    const { router } = makeRouter({ enabled: true, minRows: 1000 }, 500);
    const decision = await router.decide({ ...baseArgs, filter });
    expect(decision).toBe('postgres');
  });

  it('returns postgres when query has no filter/sort/search', async () => {
    const { router, countSpy } = makeRouter(
      { enabled: true, minRows: 10 },
      10000,
    );
    const decision = await router.decide({ ...baseArgs });
    expect(decision).toBe('postgres');
    expect(countSpy).not.toHaveBeenCalled();
  });

  it('returns postgres when search.mode === "fts" even for large base', async () => {
    const { router } = makeRouter({ enabled: true, minRows: 10 }, 10000);
    const decision = await router.decide({ ...baseArgs, search: ftsSearch });
    expect(decision).toBe('postgres');
  });

  it('returns cache when flag on + rows >= minRows + has filter', async () => {
    const { router } = makeRouter({ enabled: true, minRows: 1000 }, 1000);
    const decision = await router.decide({ ...baseArgs, filter });
    expect(decision).toBe('cache');
  });

  it('returns cache when flag on + rows >= minRows + has sort', async () => {
    const { router } = makeRouter({ enabled: true, minRows: 1000 }, 5000);
    const decision = await router.decide({ ...baseArgs, sorts });
    expect(decision).toBe('cache');
  });

  it('returns postgres when flag on + rows >= minRows + has trgm search (v1 gates search to postgres)', async () => {
    const { router } = makeRouter({ enabled: true, minRows: 10 }, 10000);
    const decision = await router.decide({ ...baseArgs, search: trgmSearch });
    expect(decision).toBe('postgres');
  });
});
