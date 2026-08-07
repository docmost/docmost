import {
  IntegrationResourceContext,
  IntegrationTableReportPayload,
} from '../integration-oauth/resource.types';
import { WINDSHIFT_RESOURCES } from './windshift.resources';

const itemResource = WINDSHIFT_RESOURCES.find((r) => r.id === 'item')!;
const reportResource = WINDSHIFT_RESOURCES.find(
  (r) => r.id === 'collectionReport',
)!;

const WINDSHIFT_ITEM = {
  id: 7,
  workspace_id: 2,
  workspace_key: 'WI',
  workspace_item_number: 123,
  title: 'Fix the flux capacitor',
  status: { name: 'In Progress' },
  priority: { name: 'High' },
  assignee: { full_name: 'Doc Brown', email: 'doc@example.com' },
};

function fakeCtx(overrides: {
  get?: jest.Mock;
  settings?: Record<string, string>;
  baseUrl?: string;
}): IntegrationResourceContext & { get: jest.Mock } {
  const get = overrides.get ?? jest.fn();
  return {
    integrationId: 'windshift:1111',
    workspaceId: 'ws-1',
    userId: 'user-1',
    get,
    client: {
      get,
      baseUrl: jest.fn().mockResolvedValue(overrides.baseUrl ?? 'https://ws.example.com'),
      settings: jest.fn().mockResolvedValue(overrides.settings ?? {}),
    },
  };
}

describe('windshift item resource', () => {
  describe('search', () => {
    it('returns nothing for an empty query without calling the provider', async () => {
      const ctx = fakeCtx({});
      await expect(itemResource.search!(ctx, { q: '  ' })).resolves.toEqual([]);
      expect(ctx.get).not.toHaveBeenCalled();
    });

    it('short-circuits direct item keys like WI-123', async () => {
      const ctx = fakeCtx({});
      const results = await itemResource.search!(ctx, { q: 'wi-123' });
      expect(results).toEqual([{ key: 'WI-123', title: 'WI-123', badge: 'WI-123' }]);
      expect(ctx.get).not.toHaveBeenCalled();
    });

    it('resolves bare numbers against the connection default workspace key', async () => {
      const ctx = fakeCtx({ settings: { defaultWorkspaceKey: 'WI' } });
      const results = await itemResource.search!(ctx, { q: '123' });
      expect(results).toEqual([{ key: 'WI-123', title: 'WI-123', badge: 'WI-123' }]);
    });

    it('treats bare numbers as text search when no default workspace key is set', async () => {
      const ctx = fakeCtx({ get: jest.fn().mockResolvedValue({ data: [] }) });
      await itemResource.search!(ctx, { q: '123' });
      expect(ctx.get).toHaveBeenCalledWith('/rest/api/v1/search/items', {
        q: '123',
        limit: 10,
        exclude_personal: 'true',
      });
    });

    it('normalizes provider search results', async () => {
      const ctx = fakeCtx({
        get: jest.fn().mockResolvedValue({ data: [WINDSHIFT_ITEM] }),
      });
      const results = await itemResource.search!(ctx, { q: 'flux', limit: 5 });
      expect(ctx.get).toHaveBeenCalledWith('/rest/api/v1/search/items', {
        q: 'flux',
        limit: 5,
        exclude_personal: 'true',
      });
      expect(results).toEqual([
        {
          key: 'WI-123',
          title: 'Fix the flux capacitor',
          subtitle: 'In Progress',
          badge: 'WI-123',
          metadata: { workspaceKey: 'WI', itemNumber: 123 },
        },
      ]);
    });
  });

  describe('resolve', () => {
    it('resolves workspace keys through the workspace item endpoint', async () => {
      const ctx = fakeCtx({
        get: jest.fn().mockResolvedValue(WINDSHIFT_ITEM),
      });
      const payload = await itemResource.resolve(ctx, { resourceKey: 'WI-123' });
      expect(ctx.get).toHaveBeenCalledWith('/rest/api/v1/workspaces/WI/items/123', {
        exclude_personal: 'true',
      });
      expect(payload).toMatchObject({
        kind: 'item-card',
        key: 'WI-123',
        title: 'Fix the flux capacitor',
        url: 'https://ws.example.com/workspaces/2/items/7',
        status: 'In Progress',
        priority: 'High',
        assignee: 'Doc Brown',
      });
    });

    it('canonicalizes paste-url id: keys via the items endpoint', async () => {
      const ctx = fakeCtx({
        get: jest.fn().mockResolvedValue(WINDSHIFT_ITEM),
      });
      const payload = await itemResource.resolve(ctx, { resourceKey: 'id:7' });
      expect(ctx.get).toHaveBeenCalledWith('/rest/api/v1/items/7', {
        exclude_personal: 'true',
      });
      expect(payload).toMatchObject({ kind: 'item-card', key: 'WI-123' });
    });

    it('rejects malformed keys with a 400-shaped error', async () => {
      const ctx = fakeCtx({});
      await expect(
        itemResource.resolve(ctx, { resourceKey: '!!nope!!' }),
      ).rejects.toMatchObject({ status: 400 });
      expect(ctx.get).not.toHaveBeenCalled();
    });
  });
});

describe('windshift collectionReport resource', () => {
  const COLLECTION = {
    id: 4,
    slug: 'sprint-board',
    name: 'Sprint board',
    description: 'Current sprint',
  };

  describe('search', () => {
    it('lists collections and maps slug keys', async () => {
      const ctx = fakeCtx({
        get: jest.fn().mockResolvedValue({ data: [COLLECTION] }),
      });
      const results = await reportResource.search!(ctx, { q: 'sprint' });
      expect(ctx.get).toHaveBeenCalledWith('/rest/api/v1/collections', {
        q: 'sprint',
        limit: 10,
      });
      expect(results).toEqual([
        {
          key: 'sprint-board',
          title: 'Sprint board',
          subtitle: 'Current sprint',
          badge: 'sprint-board',
        },
      ]);
    });

    it('falls back to numeric ids for slugless collections', async () => {
      const ctx = fakeCtx({
        get: jest
          .fn()
          .mockResolvedValue({ data: [{ ...COLLECTION, slug: undefined }] }),
      });
      const results = await reportResource.search!(ctx, {});
      expect(results[0].key).toBe('4');
    });
  });

  describe('resolve', () => {
    function reportCtx(pagination: Record<string, unknown>) {
      return fakeCtx({
        get: jest.fn().mockImplementation((path: string) => {
          if (path.endsWith('/items')) {
            return Promise.resolve({ data: [WINDSHIFT_ITEM], pagination });
          }
          return Promise.resolve(COLLECTION);
        }),
      });
    }

    it('serves page 1 by default and normalizes rows', async () => {
      const ctx = reportCtx({ total: 120, has_more: true });
      const payload = (await reportResource.resolve(ctx, {
        resourceKey: 'sprint-board',
      })) as IntegrationTableReportPayload;
      expect(ctx.get).toHaveBeenCalledWith(
        '/rest/api/v1/collections/sprint-board/items',
        { page: 1, limit: 50, exclude_personal: 'true' },
      );
      expect(payload).toMatchObject({
        kind: 'table-report',
        title: 'Sprint board',
        total: 120,
        page: 1,
        hasMore: true,
      });
      expect(payload.rows).toEqual([
        {
          id: '7',
          key: 'WI-123',
          title: 'Fix the flux capacitor',
          url: 'https://ws.example.com/workspaces/2/items/7',
          status: 'In Progress',
          assignee: 'Doc Brown',
        },
      ]);
    });

    it('passes the requested page through to the provider', async () => {
      const ctx = reportCtx({ total: 120, has_more: false });
      const payload = (await reportResource.resolve(ctx, {
        resourceKey: 'sprint-board',
        params: { page: 3 },
      })) as IntegrationTableReportPayload;
      expect(ctx.get).toHaveBeenCalledWith(
        '/rest/api/v1/collections/sprint-board/items',
        { page: 3, limit: 50, exclude_personal: 'true' },
      );
      expect(payload.page).toBe(3);
      expect(payload.hasMore).toBe(false);
    });

    it.each([
      [undefined, 1],
      [{ page: 0 }, 1],
      [{ page: -5 }, 1],
      [{ page: 2.5 }, 1],
      [{ page: 'evil' }, 1],
      [{ page: 99999999 }, 1000],
    ])('clamps params %p to page %i', async (params, expected) => {
      const ctx = reportCtx({});
      await reportResource.resolve(ctx, {
        resourceKey: 'sprint-board',
        params: params as Record<string, unknown> | undefined,
      });
      expect(ctx.get).toHaveBeenCalledWith(
        '/rest/api/v1/collections/sprint-board/items',
        { page: expected, limit: 50, exclude_personal: 'true' },
      );
    });

    it('reports hasMore=false when the provider omits pagination', async () => {
      const ctx = fakeCtx({
        get: jest.fn().mockImplementation((path: string) =>
          Promise.resolve(
            path.endsWith('/items') ? { data: [WINDSHIFT_ITEM] } : COLLECTION,
          ),
        ),
      });
      const payload = (await reportResource.resolve(ctx, {
        resourceKey: 'sprint-board',
      })) as IntegrationTableReportPayload;
      expect(payload.hasMore).toBe(false);
      expect(payload.total).toBe(1);
    });
  });
});

describe('personal workspace exclusion', () => {
  it('passes exclude_personal so the API hides personal items (404 passthrough)', async () => {
    const notFound = new Error('Item not found') as Error & { status?: number };
    notFound.status = 404;
    const ctx = fakeCtx({ get: jest.fn().mockRejectedValue(notFound) });
    await expect(
      itemResource.resolve(ctx, { resourceKey: 'PERS-4' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(ctx.get).toHaveBeenCalledWith('/rest/api/v1/workspaces/PERS/items/4', {
      exclude_personal: 'true',
    });
  });
});
