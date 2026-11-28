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
  let debug: jest.SpyInstance;
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
    debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
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

  it('reports the canonical URL of a self-hosted reply, which has no top-level url', async () => {
    env = { url: 'http://iframely:8061' };
    fetchFn.mockResolvedValue(
      json({
        meta: { title: 'Jenkins', canonical: 'http://10.0.0.5:8080/' },
        links: [],
      }),
    );
    expect(await build().getPreview('https://attacker.example/r')).toEqual({
      preview: expect.objectContaining({ title: 'Jenkins' }),
      reportedUrl: 'http://10.0.0.5:8080/',
    });
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

  it('warns with the code for an account error sent as HTTP 403', async () => {
    fetchFn.mockResolvedValue(
      json(
        {
          code: 'api.key.required',
          status: 403,
          title: 'A valid API key is required',
        },
        403,
      ),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('api.key.required'));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-key');
  });

  it.each([200, 500])(
    'warns with the code for an Iframely service error on HTTP %i',
    async (status) => {
      fetchFn.mockResolvedValue(
        json(
          { code: 'system.internal.500', status: 500, title: 'Internal error' },
          status,
        ),
      );
      expect(await build().getPreview('https://example.com/a')).toBeNull();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('system.internal.500'),
      );
    },
  );

  it('logs an error about the URL sent as HTTP 404 at debug, with its code', async () => {
    fetchFn.mockResolvedValue(
      json({ code: 'origin.http.404', status: 404, title: 'Not found' }, 404),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining('origin.http.404'),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a self-hosted error about the page at debug', async () => {
    env = { url: 'http://iframely:8061' };
    fetchFn.mockResolvedValue(
      json(
        {
          error: { source: 'iframely', code: 404, message: 'Page not found' },
        },
        404,
      ),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('404'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when a self-hosted Iframely fails with a server error', async () => {
    env = { url: 'http://iframely:8061' };
    fetchFn.mockResolvedValue(
      json(
        { error: { source: 'iframely', code: 500, message: 'Server error' } },
        500,
      ),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/http:\/\/iframely:8061 .*500/),
    );
  });

  it('warns with the status, not the body, when something other than Iframely answers', async () => {
    fetchFn.mockResolvedValue(
      new Response('<html>Cannot GET /api/iframely</html>', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      }),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      'Iframely at https://iframe.ly answered HTTP 404',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Cannot GET');
  });

  it.each(['null', '"OK"', '42', '[]'])(
    'warns that a 2xx reply of %s is not an Iframely reply',
    async (text) => {
      fetchFn.mockResolvedValue(new Response(text, { status: 200 }));
      expect(await build().getPreview('https://example.com/a')).toBeNull();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('not send an Iframely reply'),
      );
    },
  );

  it('warns when a 2xx reply carries an error it cannot read', async () => {
    fetchFn.mockResolvedValue(json({ status: 404, error: 'Not Found' }));
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('not send an Iframely reply'),
    );
  });

  it('warns that Iframely timed out while sending its reply', async () => {
    fetchFn.mockResolvedValue(
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(
              Object.assign(
                new Error('The operation was aborted due to timeout'),
                { name: 'TimeoutError' },
              ),
            );
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('timed out'));
  });

  it('logs no part of a fetch error message, which can hold the API key', async () => {
    const otherLevels = (['log', 'error', 'verbose', 'fatal'] as const).map(
      (level) => jest.spyOn(Logger.prototype, level).mockImplementation(),
    );
    fetchFn.mockRejectedValue(
      new Error(
        'Failed to parse URL from https://iframe.ly/api/iframely?url=x&api_key=secret-key',
      ),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalled();
    const logged = JSON.stringify(
      [warn, debug, ...otherLevels].map((spy) => spy.mock.calls),
    );
    expect(logged).not.toContain('secret-key');
    expect(logged).not.toContain('Failed to parse');
  });

  it('warns with the origin, error name and code when Iframely cannot be reached', async () => {
    env = { url: 'http://iframely:8061/' };
    fetchFn.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(
          new Error('connect ECONNREFUSED 172.18.0.5:8061'),
          { code: 'ECONNREFUSED' },
        ),
      }),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0];
    expect(message).toContain('http://iframely:8061');
    expect(message).toContain('TypeError');
    expect(message).toContain('ECONNREFUSED');
    expect(message).not.toContain('fetch failed');
    expect(message).not.toContain('172.18.0.5');
  });

  it('warns that Iframely timed out', async () => {
    fetchFn.mockRejectedValue(
      Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      }),
    );
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/https:\/\/iframe\.ly .*timed out/),
    );
  });

  it('names the setting instead of an origin when IFRAMELY_URL has no protocol', async () => {
    const client = new IframelyClient({
      getIframelyUrl: () => 'iframe.ly/api',
      getIframelyApiKey: () => 'secret-key',
    } as any);
    expect(await client.getPreview('https://example.com/a')).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('the configured IFRAMELY_URL'),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-key');
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
