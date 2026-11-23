import { VersionService } from './version.service';

const START = Date.UTC(2026, 0, 1);
const MINUTE = 60_000;

function makeService(opts: { disabled?: boolean } = {}) {
  const store = new Map<string, { value: unknown; expiresAt: number }>();
  const cacheManager = {
    get: async (key: string) => {
      const entry = store.get(key);
      return entry && entry.expiresAt > Date.now() ? entry.value : undefined;
    },
    set: async (key: string, value: unknown, ttlMs: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };

  const environmentService = {
    isDisableVersionCheck: () => opts.disabled ?? false,
  };

  return {
    service: new VersionService(cacheManager as any, environmentService as any),
    store,
  };
}

function latest(version: string) {
  return new Response(JSON.stringify({ latestVersion: version }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('VersionService.getVersion', () => {
  let fetchMock: jest.SpyInstance;
  let now: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    now = jest.spyOn(Date, 'now').mockReturnValue(START);
  });

  afterEach(() => {
    fetchMock.mockRestore();
    now.mockRestore();
  });

  it('asks version.docmost.com once for requests within the same hour', async () => {
    fetchMock.mockImplementation(async () => latest('9.9.9'));
    const { service } = makeService();

    const first = await service.getVersion();
    now.mockReturnValue(START + 59 * MINUTE);
    const second = await service.getVersion();

    expect(first.latestVersion).toBe('9.9.9');
    expect(second.latestVersion).toBe('9.9.9');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://version.docmost.com/api/version',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('asks again once the answer is over an hour old', async () => {
    fetchMock
      .mockImplementationOnce(async () => latest('9.9.9'))
      .mockImplementationOnce(async () => latest('10.0.0'));
    const { service } = makeService();

    await service.getVersion();
    now.mockReturnValue(START + 61 * MINUTE);
    const later = await service.getVersion();

    expect(later.latestVersion).toBe('10.0.0');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the running version and caches nothing when the check fails', async () => {
    fetchMock
      .mockImplementationOnce(async () => new Response('', { status: 503 }))
      .mockImplementationOnce(
        async () =>
          new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      )
      .mockImplementationOnce(async () => latest('9.9.9'));
    const { service } = makeService();

    const refused = await service.getVersion();
    const wrongShape = await service.getVersion();
    const next = await service.getVersion();

    expect(refused.currentVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(refused.latestVersion).toBe(0);
    expect(wrongShape.currentVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(wrongShape.latestVersion).toBe(0);
    expect(next.latestVersion).toBe('9.9.9');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('still reports the running version when version.docmost.com is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const { service } = makeService();

    const version = await service.getVersion();

    expect(version.currentVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(version.latestVersion).toBe(0);
  });

  it('does not call out when DISABLE_VERSION_CHECK is set, even with a cached answer', async () => {
    const { service, store } = makeService({ disabled: true });
    store.set('version:latest', {
      value: '9.9.9',
      expiresAt: START + 60 * MINUTE,
    });

    const version = await service.getVersion();

    expect(version.latestVersion).toBe(0);
    expect(version.currentVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
