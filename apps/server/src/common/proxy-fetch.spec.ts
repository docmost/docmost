import { getProxyAwareFetch, proxyFetch } from './proxy-fetch';

describe('getProxyAwareFetch', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns undefined when no proxy env vars are set', () => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.https_proxy;

    expect(getProxyAwareFetch()).toBeUndefined();
  });

  it('returns a fetch function when HTTP_PROXY is set', () => {
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.https_proxy;
    process.env.HTTP_PROXY = 'http://proxy.example.com:8080';

    expect(typeof getProxyAwareFetch()).toBe('function');
  });

  it('returns a fetch function when HTTPS_PROXY is set', () => {
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
    delete process.env.https_proxy;
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';

    expect(typeof getProxyAwareFetch()).toBe('function');
  });

  it('returns a fetch function when lowercase http_proxy is set', () => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    process.env.http_proxy = 'http://proxy.example.com:8080';

    expect(typeof getProxyAwareFetch()).toBe('function');
  });

  it('proxyFetch delegates to the platform fetch when no proxy is configured', async () => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.https_proxy;

    const original = globalThis.fetch;
    const response = new Response('ok');
    const spy = jest.fn().mockResolvedValue(response);
    globalThis.fetch = spy as unknown as typeof fetch;

    try {
      await expect(proxyFetch('https://example.com')).resolves.toBe(response);
      expect(spy).toHaveBeenCalledWith('https://example.com', undefined);
    } finally {
      globalThis.fetch = original;
    }
  });
});
