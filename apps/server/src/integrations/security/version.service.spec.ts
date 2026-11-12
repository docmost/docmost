import { VersionService } from './version.service';

const START = Date.UTC(2026, 0, 1);
const MINUTE = 60_000;

function makeService() {
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

  return new VersionService(cacheManager as any);
}

function release(tagName: string) {
  return new Response(JSON.stringify({ tag_name: tagName }), {
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

  it('asks GitHub once for requests within the same hour', async () => {
    fetchMock.mockImplementation(async () => release('v9.9.9'));
    const service = makeService();

    const first = await service.getVersion();
    now.mockReturnValue(START + 59 * MINUTE);
    const second = await service.getVersion();

    expect(first.latestVersion).toBe('9.9.9');
    expect(second.latestVersion).toBe('9.9.9');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks GitHub again once the answer is over an hour old', async () => {
    fetchMock
      .mockImplementationOnce(async () => release('v9.9.9'))
      .mockImplementationOnce(async () => release('v10.0.0'));
    const service = makeService();

    await service.getVersion();
    now.mockReturnValue(START + 61 * MINUTE);
    const later = await service.getVersion();

    expect(later.latestVersion).toBe('10.0.0');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not keep an answer when GitHub refuses the request', async () => {
    fetchMock
      .mockImplementationOnce(async () => new Response('', { status: 403 }))
      .mockImplementationOnce(async () => release('v9.9.9'));
    const service = makeService();

    const refused = await service.getVersion();
    const next = await service.getVersion();

    expect(refused).toBeUndefined();
    expect(next.latestVersion).toBe('9.9.9');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still reports the running version when GitHub is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const service = makeService();

    const version = await service.getVersion();

    expect(version.currentVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(version.latestVersion).toBe(0);
  });
});
