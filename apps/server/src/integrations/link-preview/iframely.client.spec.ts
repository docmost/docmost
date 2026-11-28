import { Logger } from '@nestjs/common';
import { IframelyClient } from './iframely.client';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('IframelyClient', () => {
  let fetchFn: jest.Mock;
  let warn: jest.SpyInstance;
  let env: { url: string; key?: string };
  const build = () =>
    new IframelyClient(
      {
        getIframelyUrl: () => env.url,
        getIframelyApiKey: () => env.key,
      } as any,
      fetchFn as any,
    );

  beforeEach(() => {
    jest.restoreAllMocks();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    fetchFn = jest.fn();
    env = { url: 'https://iframe.ly/api', key: 'secret-key' };
  });

  it('asks the hosted API with the key, a JSON accept header and a timeout', async () => {
    fetchFn.mockResolvedValue(
      json({ url: 'https://example.com/a', meta: { title: 'A' } }),
    );
    const result = await build().getPreview('https://example.com/a?x=1&y=2');
    const [requestUrl, init] = fetchFn.mock.calls[0];
    const sent = new URL(requestUrl);
    expect(sent.origin + sent.pathname).toBe('https://iframe.ly/api/iframely');
    expect(sent.searchParams.get('url')).toBe('https://example.com/a?x=1&y=2');
    expect(sent.searchParams.get('api_key')).toBe('secret-key');
    expect(init.headers.accept).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({
      preview: expect.objectContaining({ title: 'A' }),
      reportedUrl: 'https://example.com/a',
    });
  });

  it('sends no key to a self-hosted server and drops a trailing slash', async () => {
    env = { url: 'http://iframely:8061/' };
    fetchFn.mockResolvedValue(json({ meta: { title: 'A' } }));
    await build().getPreview('https://example.com/a');
    const sent = new URL(fetchFn.mock.calls[0][0]);
    expect(sent.origin + sent.pathname).toBe('http://iframely:8061/iframely');
    expect(sent.searchParams.has('api_key')).toBe(false);
  });

  it('returns null for an account error on HTTP 200 and warns without the key', async () => {
    fetchFn.mockResolvedValue(
      json({
        code: 'api.key.required',
        status: 403,
        title: 'A valid API key is required',
      }),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('api.key.required'));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-key');
  });

  it('returns null without a warning for an error about the URL', async () => {
    fetchFn.mockResolvedValue(
      json({ code: 'origin.http.404', status: 404, title: 'Not found' }),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns null for a non-2xx response', async () => {
    fetchFn.mockResolvedValue(json({ error: 'Not found' }, 404));
    expect(await build().getPreview('https://example.com/a')).toBeNull();
  });

  it('returns null and warns when the answer is not JSON', async () => {
    fetchFn.mockResolvedValue(
      new Response('<html>Welcome</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('returns null when Iframely ends on a sign-in page the pasted link was not', async () => {
    fetchFn.mockResolvedValue(
      json({
        url: 'https://accounts.google.com/ServiceLogin',
        meta: { title: 'Sign in' },
      }),
    );
    expect(
      await build().getPreview('https://docs.google.com/document/d/x'),
    ).toBeNull();
  });
});
