import { BadRequestException, HttpException } from '@nestjs/common';
import { UnsplashService } from './unsplash.service';

const API = 'https://api.unsplash.com';
const USER_ID = '019a1f00-0000-7000-8000-000000000005';

function apiPhoto(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    description: `Photo ${id}`,
    alt_description: null,
    color: '#335577',
    urls: {
      raw: `https://images.unsplash.com/photo-${id}?ixid=abc`,
      small: `https://images.unsplash.com/photo-${id}?ixid=abc&w=400`,
    },
    links: { download_location: `${API}/photos/${id}/download?ixid=abc` },
    user: { name: `Author ${id}`, username: `author_${id}` },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeService(accessKey = 'test-key') {
  const store = new Map<string, unknown>();
  const cacheManager = {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
  const environmentService = {
    getUnsplashAccessKey: () => accessKey,
  };
  const service = new UnsplashService(
    environmentService as any,
    cacheManager as any,
  );
  return { service, cacheManager };
}

describe('UnsplashService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  const requestedUrl = (call = 0) => new URL(fetchMock.mock.calls[call][0]);
  const requestedHeaders = (call = 0) =>
    fetchMock.mock.calls[call][1].headers as Record<string, string>;

  it('searches landscape photos with the access key and returns trimmed results', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ total_pages: 3, results: [apiPhoto('a1'), apiPhoto('b2')] }),
    );

    const result = await service.listPhotos('mountains', 1);

    expect(requestedUrl().pathname).toBe('/search/photos');
    expect(requestedUrl().searchParams.get('query')).toBe('mountains');
    expect(requestedUrl().searchParams.get('orientation')).toBe('landscape');
    expect(requestedUrl().searchParams.get('content_filter')).toBe('high');
    expect(requestedHeaders()['Authorization']).toBe('Client-ID test-key');
    expect(result).toEqual({
      hasMore: true,
      items: [
        {
          id: 'a1',
          description: 'Photo a1',
          color: '#335577',
          thumbUrl: 'https://images.unsplash.com/photo-a1?ixid=abc&w=400',
          coverUrl:
            'https://images.unsplash.com/photo-a1?ixid=abc&w=2560&q=80&auto=format&fit=max',
          authorName: 'Author a1',
          authorUsername: 'author_a1',
        },
        expect.objectContaining({ id: 'b2' }),
      ],
    });
  });

  it('serves a repeated search from the cache', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValue(
      jsonResponse({ total_pages: 1, results: [apiPhoto('a1')] }),
    );

    await service.listPhotos('Mountains ', 1);
    const again = await service.listPhotos('mountains', 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again.items).toHaveLength(1);
    expect(again.hasMore).toBe(false);
  });

  it('lists wallpapers when there is no search', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValueOnce(jsonResponse([apiPhoto('w1')]));

    const result = await service.listPhotos('', 2);

    expect(requestedUrl().pathname).toBe('/topics/wallpapers/photos');
    expect(requestedUrl().searchParams.get('page')).toBe('2');
    expect(requestedUrl().searchParams.get('orientation')).toBe('landscape');
    expect(result.items.map((item) => item.id)).toEqual(['w1']);
    expect(result.hasMore).toBe(false);
  });

  it('drops photos that are not served from images.unsplash.com', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        total_pages: 1,
        results: [
          apiPhoto('ok'),
          apiPhoto('bad', {
            urls: { raw: 'https://evil.example/x.jpg', small: 'https://evil.example/x.jpg' },
          }),
          apiPhoto('worse', { user: { name: 'X', username: 'x"><script>' } }),
          apiPhoto('sneaky', {
            links: { download_location: 'https://evil.example/track' },
          }),
        ],
      }),
    );

    const result = await service.listPhotos('x', 1);

    expect(result.items.map((item) => item.id)).toEqual(['ok']);
  });

  it('turns a listed wallpaper into a cover, tracking the download', async () => {
    const { service } = makeService();
    fetchMock
      .mockResolvedValueOnce(jsonResponse([apiPhoto('a1')]))
      .mockResolvedValueOnce(jsonResponse({ url: 'https://images.unsplash.com/x' }));
    await service.listPhotos('', 1);

    const cover = await service.getCover('a1', USER_ID);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(1).toString()).toBe(`${API}/photos/a1/download?ixid=abc`);
    expect(requestedHeaders(1)['Authorization']).toBe('Client-ID test-key');
    expect(cover).toEqual({
      coverPhoto:
        'https://images.unsplash.com/photo-a1?ixid=abc&w=2560&q=80&auto=format&fit=max',
      coverAttribution: {
        source: 'unsplash',
        photoId: 'a1',
        authorName: 'Author a1',
        authorUsername: 'author_a1',
      },
    });
  });

  it('looks a photo found by search up again, so the cover carries no search term', async () => {
    const { service } = makeService();
    const searched = apiPhoto('a1', {
      urls: {
        raw: 'https://images.unsplash.com/photo-a1?ixid=from-search',
        small: 'https://images.unsplash.com/photo-a1?ixid=from-search&w=400',
      },
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ total_pages: 1, results: [searched] }))
      .mockResolvedValueOnce(jsonResponse(apiPhoto('a1')))
      .mockResolvedValueOnce(jsonResponse({}));
    await service.listPhotos('team offsite', 1);

    const cover = await service.getCover('a1', USER_ID);

    expect(requestedUrl(1).pathname).toBe('/photos/a1');
    expect(cover.coverPhoto).not.toContain('from-search');
  });

  it('looks up a photo it has not listed', async () => {
    const { service } = makeService();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(apiPhoto('z9')))
      .mockResolvedValueOnce(jsonResponse({}));

    const cover = await service.getCover('z9', USER_ID);

    expect(requestedUrl(0).pathname).toBe('/photos/z9');
    expect(cover.coverAttribution.photoId).toBe('z9');
  });

  it('still sets the cover when download tracking fails', async () => {
    const { service } = makeService();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(apiPhoto('z9')))
      .mockRejectedValueOnce(new Error('network down'));

    await expect(service.getCover('z9', USER_ID)).resolves.toMatchObject({
      coverAttribution: { photoId: 'z9' },
    });
  });

  it('refuses to work without an access key', async () => {
    const { service } = makeService('');

    expect(service.isEnabled()).toBe(false);
    await expect(service.listPhotos('x', 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the Unsplash rate limit as 429', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValueOnce(new Response('Rate Limit Exceeded', { status: 403 }));

    const error = await service.listPhotos('x', 1).catch((err) => err);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
  });

  it('reports an unknown photo as not found', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));

    const error = await service.getCover('missing', USER_ID).catch((err) => err);

    expect(error.getStatus()).toBe(404);
  });

  it('reports a rejected access key as unavailable, never as 401', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValueOnce(new Response('OAuth error', { status: 401 }));

    const error = await service.listPhotos('x', 1).catch((err) => err);

    expect(error.getStatus()).toBe(503);
  });

  it('reports a malformed response as unavailable and does not cache it', async () => {
    const { service } = makeService();
    fetchMock
      .mockResolvedValueOnce(new Response('<html>maintenance</html>', { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ total_pages: 1, results: {} }))
      .mockResolvedValueOnce(jsonResponse({ total_pages: 1, results: [apiPhoto('a1')] }));

    expect((await service.listPhotos('x', 1).catch((err) => err)).getStatus()).toBe(503);
    expect((await service.listPhotos('x', 1).catch((err) => err)).getStatus()).toBe(503);
    const result = await service.listPhotos('x', 1);

    expect(result.items.map((item) => item.id)).toEqual(['a1']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('stops at the last page it accepts', async () => {
    const { service } = makeService();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ total_pages: 200, results: [apiPhoto('a1')] }),
    );

    const result = await service.listPhotos('x', 50);

    expect(result.hasMore).toBe(false);
  });

  it('limits how many covers one user can pick a minute', async () => {
    const { service } = makeService();
    fetchMock.mockImplementation(async () => jsonResponse(apiPhoto('z9')));

    for (let i = 0; i < 30; i++) {
      await service.getCover('z9', USER_ID);
    }
    const error = await service.getCover('z9', USER_ID).catch((err) => err);
    const otherUser = await service.getCover('z9', 'another-user');

    expect(error.getStatus()).toBe(429);
    expect(otherUser.coverAttribution.photoId).toBe('z9');
  });
});
