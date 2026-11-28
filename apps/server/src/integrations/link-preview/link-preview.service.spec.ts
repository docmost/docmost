import { createHash } from 'crypto';
import { Logger } from '@nestjs/common';
import { LinkPreviewService } from './link-preview.service';
import {
  OutboundUrlError,
  OutboundUrlGuard,
} from '../outbound/outbound-url.guard';
import { OutboundAgentFactory } from '../outbound/outbound-agent.factory';

const keyFor = (url: string) =>
  'link-preview:' + createHash('sha256').update(url).digest('hex');

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const page = (head: string, body = '') =>
  new Response(`<html><head>${head}</head><body>${body}</body></html>`, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

const html = (title: string) =>
  new Response(`<html><head><title>${title}</title></head><body></body></html>`, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

const redirect = (location: string, status = 301) =>
  new Response(null, { status, headers: { location } });

describe('LinkPreviewService', () => {
  let store: Map<string, string>;
  let redis: { get: jest.Mock; set: jest.Mock };
  let release: jest.Mock;
  let lease: jest.Mock;
  let fetchFn: jest.Mock;
  let isCloud: boolean;
  let disabled: boolean;

  let resolve4: jest.Mock;
  let resolve6: jest.Mock;

  const build = () => {
    const service = new LinkPreviewService(
      { lease } as any,
      { isCloud: () => isCloud, isDisableLinkPreviews: () => disabled } as any,
      { getOrThrow: () => redis } as any,
      fetchFn as any,
    );
    (service as any).resolver = { resolve4, resolve6 };
    return service;
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    store = new Map();
    redis = {
      get: jest.fn(async (k: string) => store.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
        return 'OK';
      }),
    };
    resolve4 = jest.fn(async () => ['93.184.216.34']);
    resolve6 = jest.fn(async () => []);
    release = jest.fn(async () => undefined);
    lease = jest.fn(async () => ({ dispatcher: {}, release }));
    fetchFn = jest.fn();
    isCloud = false;
    disabled = false;
  });

  it("returns the page's preview and caches it for an hour", async () => {
    fetchFn.mockResolvedValue(html('Hello'));
    const result = await build().getPreview('https://example.com/a');
    expect(result?.title).toBe('Hello');
    expect(redis.set).toHaveBeenCalledWith(
      keyFor('https://example.com/a'),
      JSON.stringify(result),
      'EX',
      3600,
    );
  });

  it('leases each hop for public addresses only, through a configured proxy', async () => {
    fetchFn.mockResolvedValue(html('Hello'));
    await build().getPreview('https://example.com/a');
    expect(lease).toHaveBeenCalledWith('https://example.com/a', undefined, {
      viaProxy: true,
      publicOnly: true,
    });
  });

  it('asks for English and sends no user setting', async () => {
    fetchFn.mockResolvedValue(html('Hello'));
    await build().getPreview('https://example.com/a');
    expect(fetchFn.mock.calls[0][1].headers).toEqual({
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en',
      'user-agent': 'DocmostBot-LinkPreview (+https://docmost.com/robots)',
    });
  });

  it('fetches with manual redirects and an abort signal', async () => {
    fetchFn.mockResolvedValue(html('Hello'));
    await build().getPreview('https://example.com/a');
    const init = fetchFn.mock.calls[0][1];
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps the fragment in the cache key but not in the request', async () => {
    fetchFn.mockResolvedValue(html('Hello'));
    await build().getPreview('https://example.com/a#part');
    expect(lease.mock.calls[0][0]).toBe('https://example.com/a');
    expect(redis.set.mock.calls[0][0]).toBe(keyFor('https://example.com/a#part'));
  });

  it('caches an empty fragment under the plain URL', async () => {
    fetchFn.mockResolvedValue(html('Hello'));
    await build().getPreview('https://example.com/a#');
    expect(redis.set.mock.calls[0][0]).toBe(keyFor('https://example.com/a'));
  });

  it('titles a fragment link with its section, reading past the head', async () => {
    const chunks = [
      '<html><head><title>Guide</title></head>',
      '<body><h2 id="install">Install</h2><p>Run it.</p></body></html>',
    ].map((c) => new TextEncoder().encode(c));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const next = chunks.shift();
        if (next) controller.enqueue(next);
        else controller.close();
      },
    });
    fetchFn.mockResolvedValue(
      new Response(body, { headers: { 'content-type': 'text/html' } }),
    );
    const result = await build().getPreview('https://example.com/guide#install');
    expect(result).toMatchObject({ title: 'Install - Guide', description: 'Run it.' });
  });

  it('falls back to host and path when the page has no title', async () => {
    fetchFn.mockResolvedValue(page(''));
    const result = await build().getPreview('https://example.com/docs/');
    expect(result?.title).toBe('example.com/docs');
  });

  describe('oEmbed', () => {
    const video = 'https://www.youtube.com/watch?v=abc';

    it('asks a known provider first and skips the page', async () => {
      fetchFn.mockResolvedValueOnce(
        json({
          title: 'Video',
          thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
          provider_url: 'https://www.youtube.com/',
          html: '<iframe></iframe>',
        }),
      );
      const result = await build().getPreview(video);
      expect(result).toEqual({
        title: 'Video',
        image: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
        icon: 'https://www.youtube.com/favicon.ico',
      });
      expect(fetchFn).toHaveBeenCalledTimes(1);
      const endpoint = new URL(lease.mock.calls[0][0]);
      expect(endpoint.origin + endpoint.pathname).toBe('https://www.youtube.com/oembed');
      expect(endpoint.searchParams.get('url')).toBe(video);
      expect(fetchFn.mock.calls[0][1].headers.accept).toBe('application/json');
    });

    it('fetches the page when the provider fails', async () => {
      fetchFn
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(html('Channel'));
      const result = await build().getPreview('https://www.youtube.com/@channel');
      expect(result?.title).toBe('Channel');
      expect(lease.mock.calls[1][0]).toBe('https://www.youtube.com/@channel');
    });

    it('fetches the page when the provider answers without a title', async () => {
      fetchFn
        .mockResolvedValueOnce(json({ thumbnail_url: 'https://i.ytimg.com/x.jpg' }))
        .mockResolvedValueOnce(html('From page'));
      expect((await build().getPreview(video))?.title).toBe('From page');
    });

    it('fetches the page when the provider answers with something other than JSON', async () => {
      fetchFn
        .mockResolvedValueOnce(html('Consent'))
        .mockResolvedValueOnce(html('From page'));
      expect((await build().getPreview(video))?.title).toBe('From page');
    });

    const withLink = (head: string) =>
      page(`${head}<link rel="alternate" type="application/json+oembed" href="/oembed?u=1">`);

    it("follows the page's oEmbed link when the page has no image", async () => {
      fetchFn
        .mockResolvedValueOnce(withLink('<title>Track</title>'))
        .mockResolvedValueOnce(
          json({ title: 'Other title', thumbnail_url: 'https://cdn.example.com/t.jpg' }),
        );
      const result = await build().getPreview('https://example.com/track');
      expect(result).toMatchObject({ title: 'Track', image: 'https://cdn.example.com/t.jpg' });
      expect(result).not.toHaveProperty('oembedUrl');
      expect(lease.mock.calls[1][0]).toBe('https://example.com/oembed?u=1');
    });

    it("uses the oEmbed title when the page has none", async () => {
      fetchFn
        .mockResolvedValueOnce(withLink(''))
        .mockResolvedValueOnce(json({ title: 'Named by oEmbed' }));
      expect((await build().getPreview('https://example.com/track'))?.title).toBe(
        'Named by oEmbed',
      );
    });

    it('skips the oEmbed link when the page has a title and an image', async () => {
      fetchFn.mockResolvedValueOnce(
        withLink('<title>Track</title><meta property="og:image" content="https://cdn.example.com/og.jpg">'),
      );
      const result = await build().getPreview('https://example.com/track');
      expect(result?.image).toBe('https://cdn.example.com/og.jpg');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("keeps the page's preview when its oEmbed link fails", async () => {
      fetchFn
        .mockResolvedValueOnce(withLink('<title>Track</title>'))
        .mockResolvedValueOnce(new Response('boom', { status: 500 }));
      const result = await build().getPreview('https://example.com/track');
      expect(result?.title).toBe('Track');
      expect(result?.image).toBeUndefined();
    });
  });

  describe('cookies', () => {
    const redirectWithCookie = (location: string) =>
      new Response(null, {
        status: 302,
        headers: [
          ['location', location],
          ['set-cookie', 'session=1; Path=/; HttpOnly'],
        ],
      });

    it('sends a cookie set during a redirect back to the same host', async () => {
      fetchFn
        .mockResolvedValueOnce(redirectWithCookie('/landing'))
        .mockResolvedValueOnce(html('Hello'));
      expect((await build().getPreview('https://example.com/start'))?.title).toBe('Hello');
      expect(fetchFn.mock.calls[0][1].headers.cookie).toBeUndefined();
      expect(fetchFn.mock.calls[1][1].headers.cookie).toBe('session=1');
    });

    it('never sends that cookie to another host', async () => {
      fetchFn
        .mockResolvedValueOnce(redirectWithCookie('https://other.example.net/'))
        .mockResolvedValueOnce(html('Other'));
      await build().getPreview('https://example.com/start');
      expect(fetchFn.mock.calls[1][1].headers.cookie).toBeUndefined();
    });
  });


  it('on Cloud fetches an http link over https and caches it under the given URL', async () => {
    isCloud = true;
    fetchFn.mockResolvedValue(html('Secure'));
    const result = await build().getPreview('http://example.com/a#part');
    expect(result?.title).toBe('Secure');
    expect(lease.mock.calls[0][0]).toBe('https://example.com/a');
    expect(redis.set.mock.calls[0][0]).toBe(keyFor('http://example.com/a#part'));
  });

  it('fetches an http link as given when self-hosted', async () => {
    fetchFn.mockResolvedValue(html('Plain'));
    await build().getPreview('http://example.com/a');
    expect(lease.mock.calls[0][0]).toBe('http://example.com/a');
  });

  it('follows a redirect with a fresh lease per hop', async () => {
    fetchFn
      .mockResolvedValueOnce(redirect('/next'))
      .mockResolvedValueOnce(html('Next'));
    const result = await build().getPreview('https://example.com/a');
    expect(result?.title).toBe('Next');
    expect(lease.mock.calls.map((c) => c[0])).toEqual([
      'https://example.com/a',
      'https://example.com/next',
    ]);
    expect(release).toHaveBeenCalledTimes(2);
  });

  it('refuses a redirect into a private network', async () => {
    lease
      .mockResolvedValueOnce({ dispatcher: {}, release })
      .mockRejectedValueOnce(new OutboundUrlError('blocked'));
    fetchFn.mockResolvedValueOnce(redirect('http://10.0.0.1/'));
    const result = await build().getPreview('https://example.com/a');
    expect(result).toBeNull();
    expect(redis.set).toHaveBeenCalledWith(
      keyFor('https://example.com/a'),
      'null',
      'EX',
      300,
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it.each(['10.0.0.5', '127.0.0.1'])(
    'skips a host on %s even when ALLOWED_PRIVATE_NETWORKS allows it',
    async (address) => {
      const env = {
        isCloud: () => false,
        isDisableLinkPreviews: () => false,
        getAllowedPrivateNetworks: () => 'all,127.0.0.0/8',
      };
      const guard = new OutboundUrlGuard(env as any, async () => [
        { address, family: 4 },
      ]);
      const service = new LinkPreviewService(
        new OutboundAgentFactory(guard),
        env as any,
        { getOrThrow: () => redis } as any,
        fetchFn as any,
      );
      (service as any).resolver = { resolve4, resolve6 };

      const result = await service.getPreview('http://intranet.example/');

      expect(result).toBeNull();
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it('gives up after five redirects', async () => {
    fetchFn.mockImplementation(async () => redirect('/loop', 302));
    const result = await build().getPreview('https://example.com/a');
    expect(result).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(6);
    expect(release).toHaveBeenCalledTimes(6);
  });

  it('returns null for a 404', async () => {
    fetchFn.mockResolvedValue(new Response('nope', { status: 404 }));
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('gives no preview when a redirect ends on a sign-in page', async () => {
    fetchFn
      .mockResolvedValueOnce(
        redirect('https://accounts.google.com/ServiceLogin?x', 302),
      )
      .mockResolvedValueOnce(html('Sign in'));
    expect(await build().getPreview('https://docs.example.com/d')).toBeNull();
  });

  it('previews a page about sign-in after a redirect', async () => {
    fetchFn
      .mockResolvedValueOnce(redirect('https://docs.example.com/saml/'))
      .mockResolvedValueOnce(html('SAML single sign-on'));
    const result = await build().getPreview('https://docs.example.com/saml');
    expect(result?.title).toBe('SAML single sign-on');
  });

  it('previews a direct link to a sign-in page', async () => {
    fetchFn.mockResolvedValue(html('Sign in'));
    const result = await build().getPreview(
      'https://accounts.google.com/ServiceLogin?x',
    );
    expect(result?.title).toBe('Sign in');
  });

  it('describes an image without reading it', async () => {
    const response = new Response('png', {
      headers: { 'content-type': 'image/png' },
    });
    const cancel = jest.spyOn(response.body!, 'cancel');
    fetchFn.mockResolvedValue(response);
    expect(await build().getPreview('https://example.com/pics/photo.png')).toEqual(
      { title: 'photo.png', image: 'https://example.com/pics/photo.png' },
    );
    expect(cancel).toHaveBeenCalled();
  });

  it('omits the image when the URL is over the length cap', async () => {
    fetchFn.mockResolvedValue(
      new Response('png', { headers: { 'content-type': 'image/png' } }),
    );
    const result = await build().getPreview(
      `https://example.com/${'a'.repeat(2100)}.png`,
    );
    expect(result?.title).toBeDefined();
    expect(result?.image).toBeUndefined();
  });

  it('describes other files by name', async () => {
    const response = new Response('pdf', {
      headers: { 'content-type': 'application/pdf' },
    });
    const cancel = jest.spyOn(response.body!, 'cancel');
    fetchFn.mockResolvedValue(response);
    expect(await build().getPreview('https://example.com/docs/spec.pdf')).toEqual(
      { title: 'spec.pdf' },
    );
    expect(cancel).toHaveBeenCalled();
  });

  it('stops reading after 1 MB', async () => {
    const cancel = jest.fn();
    const first = new TextEncoder().encode(
      '<html><head><title>Big</title></head>'.replace('</head>', ''),
    );
    const chunk = new Uint8Array(512 * 1024).fill(97);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent === 0) controller.enqueue(first);
        else controller.enqueue(chunk);
        sent += 1;
      },
      cancel,
    });
    fetchFn.mockResolvedValue(
      new Response(body, { headers: { 'content-type': 'text/html' } }),
    );
    const result = await build().getPreview('https://example.com/big');
    expect(result?.title).toBe('Big');
    expect(cancel).toHaveBeenCalled();
    expect(sent).toBeLessThan(6);
  });

  it('serves the cache without fetching', async () => {
    store.set(
      keyFor('https://example.com/a'),
      JSON.stringify({ title: 'Cached' }),
    );
    expect(await build().getPreview('https://example.com/a')).toEqual({
      title: 'Cached',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('serves a cached failure as null', async () => {
    store.set(keyFor('https://example.com/a'), 'null');
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refresh skips the cache read but still writes', async () => {
    store.set(
      keyFor('https://example.com/a'),
      JSON.stringify({ title: 'Cached' }),
    );
    fetchFn.mockResolvedValue(html('Fresh'));
    const result = await build().getPreview('https://example.com/a', {
      refresh: true,
    });
    expect(result?.title).toBe('Fresh');
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalled();
  });

  it('returns null on a timeout', async () => {
    fetchFn.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('returns null for a non-http URL without fetching', async () => {
    expect(await build().getPreview('ftp://example.com/a')).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('stops reading at an uppercase </HEAD that arrives in a later chunk', async () => {
    const cancel = jest.fn();
    const chunks = [
      '<html><head><title>Late</title>',
      '<meta name="x" content="y"></HE',
      'AD><body>',
    ].map((c) => new TextEncoder().encode(c));
    let i = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < chunks.length) controller.enqueue(chunks[i++]);
        else i += 1;
      },
      cancel,
    });
    fetchFn.mockResolvedValue(
      new Response(body, { headers: { 'content-type': 'text/html' } }),
    );
    const result = await build().getPreview('https://example.com/late');
    expect(result?.title).toBe('Late');
    expect(cancel).toHaveBeenCalled();
    expect(i).toBeLessThanOrEqual(4);
  });

  it('fails fast when DNS times out', async () => {
    const timeout = Object.assign(new Error('timeout'), { code: 'ETIMEOUT' });
    resolve4.mockRejectedValue(timeout);
    resolve6.mockRejectedValue(timeout);
    expect(await build().getPreview('https://slow.example.com/a')).toBeNull();
    expect(lease).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(redis.set.mock.calls[0].slice(1)).toEqual(['null', 'EX', 300]);
  });

  it('fails when only AAAA times out', async () => {
    resolve6.mockRejectedValue(
      Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }),
    );
    expect(await build().getPreview('https://half.example.com/a')).toBeNull();
    expect(lease).not.toHaveBeenCalled();
  });

  it('proceeds when both answer', async () => {
    resolve6.mockResolvedValue(['2606:2800:220:1::1']);
    fetchFn.mockResolvedValue(html('Both'));
    expect((await build().getPreview('https://example.com/a'))?.title).toBe(
      'Both',
    );
  });

  it.each(['ENOTFOUND', 'ENODATA'])(
    'falls through to the guard when DNS has no answer (%s)',
    async (code) => {
      const missing = Object.assign(new Error('nx'), { code });
      resolve4.mockRejectedValue(missing);
      resolve6.mockRejectedValue(missing);
      fetchFn.mockResolvedValue(html('Hosts'));
      const result = await build().getPreview('https://intranet/a');
      expect(lease).toHaveBeenCalled();
      expect(result?.title).toBe('Hosts');
    },
  );

  it('does not start a hop after the budget is spent', async () => {
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort());
    expect(await build().getPreview('https://example.com/a')).toBeNull();
    expect(resolve4).not.toHaveBeenCalled();
    expect(lease).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('resolves to null when something throws undefined', async () => {
    lease.mockRejectedValue(undefined);
    expect(await build().getPreview('https://example.com/a')).toBeNull();
  });

  it('skips the preflight for IP literals', async () => {
    fetchFn.mockResolvedValue(html('Ip'));
    await build().getPreview('https://93.184.216.34/a');
    await build().getPreview('https://[2606:2800:220:1::1]/a');
    expect(resolve4).not.toHaveBeenCalled();
    expect(resolve6).not.toHaveBeenCalled();
  });

  describe('with link previews disabled', () => {
    it('returns null without touching Redis, DNS or the network', async () => {
      disabled = true;
      expect(await build().getPreview('https://example.com/a')).toBeNull();
      for (const mock of [redis.get, redis.set, resolve4, resolve6, lease, fetchFn]) {
        expect(mock).not.toHaveBeenCalled();
      }
    });

    it('also skips a refresh request', async () => {
      disabled = true;
      expect(
        await build().getPreview('https://example.com/a', { refresh: true }),
      ).toBeNull();
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });
});
