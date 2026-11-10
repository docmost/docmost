import { Logger } from '@nestjs/common';
import { RefreshLock } from './refresh-lock';

const KEY = 'integration:refresh:connection-1';

// Emulates SET NX, the compare-and-delete release script, DEL and EXISTS over a Map.
function fakeRedis() {
  const keys = new Map<string, string>();
  return {
    keys,
    set: jest.fn(async (key: string, value: string) => {
      if (keys.has(key)) return null;
      keys.set(key, value);
      return 'OK';
    }),
    eval: jest.fn(async (_script: string, _numKeys: number, key: string, token: string) => {
      if (keys.get(key) !== token) return 0;
      keys.delete(key);
      return 1;
    }),
    del: jest.fn(async (key: string) => Number(keys.delete(key))),
    exists: jest.fn(async (key: string) => (keys.has(key) ? 1 : 0)),
  };
}

describe('RefreshLock', () => {
  let redis: ReturnType<typeof fakeRedis>;
  let lock: RefreshLock;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    redis = fakeRedis();
    lock = new RefreshLock(redis as any);
  });

  it('takes the lock for 20 seconds only if nobody holds it', async () => {
    const token = await lock.acquire('connection-1');

    expect(token).toEqual(expect.any(String));
    expect(redis.set).toHaveBeenCalledWith(KEY, token, 'PX', 20_000, 'NX');
    expect(redis.keys.get(KEY)).toBe(token);
  });

  it('gives each holder its own token', async () => {
    const first = await lock.acquire('connection-1');
    await lock.release('connection-1', first);

    const second = await lock.acquire('connection-1');

    expect(second).not.toBe(first);
  });

  it('refuses the lock while someone else holds it', async () => {
    redis.keys.set(KEY, 'other-holder');

    await expect(lock.acquire('connection-1')).resolves.toBeNull();

    expect(redis.keys.get(KEY)).toBe('other-holder');
  });

  it('counts a Redis error as not acquired', async () => {
    redis.set.mockRejectedValue(new Error('connection lost'));

    await expect(lock.acquire('connection-1')).resolves.toBeNull();
  });

  it('releases a lock it holds', async () => {
    const token = await lock.acquire('connection-1');

    await lock.release('connection-1', token);

    expect(redis.keys.has(KEY)).toBe(false);
  });

  it('never deletes a lock another holder took after its own expired', async () => {
    const stale = await lock.acquire('connection-1');
    redis.keys.delete(KEY);
    const current = await lock.acquire('connection-1');

    await lock.release('connection-1', stale);

    expect(redis.keys.get(KEY)).toBe(current);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('leaves the lock to expire when the release fails', async () => {
    redis.eval.mockRejectedValue(new Error('connection lost'));

    await expect(lock.release('connection-1', 'token')).resolves.toBeUndefined();
  });

  it('waits until the holder releases the lock', async () => {
    redis.keys.set(KEY, 'other-holder');
    redis.exists.mockImplementationOnce(async () => {
      redis.keys.delete(KEY);
      return 1;
    });

    await lock.waitForRelease('connection-1', { timeoutMs: 1000, pollMs: 10 });

    expect(redis.exists).toHaveBeenCalledTimes(2);
  });

  it('stops waiting at the timeout while the lock is still held', async () => {
    redis.keys.set(KEY, 'other-holder');
    const started = Date.now();

    await lock.waitForRelease('connection-1', { timeoutMs: 50, pollMs: 10 });

    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    expect(redis.exists.mock.calls.length).toBeGreaterThan(1);
    expect(redis.keys.get(KEY)).toBe('other-holder');
  });

  it('stops waiting when Redis fails', async () => {
    redis.exists.mockRejectedValue(new Error('connection lost'));

    await lock.waitForRelease('connection-1', { timeoutMs: 1000, pollMs: 10 });

    expect(redis.exists).toHaveBeenCalledTimes(1);
  });
});
