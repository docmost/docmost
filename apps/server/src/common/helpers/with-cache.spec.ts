import { withCache } from './with-cache';

function makeCache(cached?: unknown) {
  return {
    get: jest.fn(async () => (cached === undefined ? undefined : { v: cached })),
    set: jest.fn(async () => undefined),
  };
}

describe('withCache', () => {
  it('returns a cached value without running the lookup', async () => {
    const cache = makeCache('cached');
    const lookup = jest.fn(async () => 'fresh');

    await expect(withCache(cache as any, 'key', 1000, lookup)).resolves.toBe('cached');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('skips the cache entirely when asked', async () => {
    const cache = makeCache('cached');
    const lookup = jest.fn(async () => 'fresh');

    await expect(
      withCache(cache as any, 'key', 1000, lookup, { skipCache: true }),
    ).resolves.toBe('fresh');
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });
});
