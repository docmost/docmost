import {
  IntegrationItemCardPayload,
  IntegrationResourceContext,
  IntegrationResourceManifest,
  IntegrationResourceSearchResult,
  IntegrationTableReportPayload,
} from '../integration-oauth/resource.types';

interface WindshiftItem {
  id: number;
  workspace_id: number;
  workspace_key: string;
  workspace_item_number: number;
  key?: string;
  title: string;
  status?: { name?: string };
  priority?: { name?: string };
  assignee?: { full_name?: string; email?: string };
}

interface WindshiftCollection {
  id: number;
  slug?: string;
  name: string;
  description?: string;
}

function windshiftUrl(baseUrl: string, path: string): string | undefined {
  const base = baseUrl.replace(/\/+$/, '');
  if (!base) return undefined;
  return `${base}${path}`;
}

function itemKey(item: WindshiftItem): string {
  return item.key || `${item.workspace_key}-${item.workspace_item_number}`;
}

function itemUrl(baseUrl: string, item: WindshiftItem): string | undefined {
  return windshiftUrl(
    baseUrl,
    `/workspaces/${item.workspace_id}/items/${item.id}`,
  );
}

function normalizeItemCard(
  baseUrl: string,
  item: WindshiftItem,
): IntegrationItemCardPayload {
  return {
    kind: 'item-card',
    key: itemKey(item),
    title: item.title,
    url: itemUrl(baseUrl, item),
    status: item.status?.name,
    priority: item.priority?.name,
    assignee: item.assignee?.full_name ?? item.assignee?.email,
    metadata: {
      id: item.id,
      workspaceId: item.workspace_id,
      workspaceKey: item.workspace_key,
      itemNumber: item.workspace_item_number,
    },
  };
}

function normalizeItemSearch(
  item: WindshiftItem,
): IntegrationResourceSearchResult {
  return {
    key: itemKey(item),
    title: item.title,
    subtitle: item.status?.name,
    badge: itemKey(item),
    metadata: {
      workspaceKey: item.workspace_key,
      itemNumber: item.workspace_item_number,
    },
  };
}

function parseItemKey(
  raw: string,
): { workspaceKey: string; itemNumber: number } | null {
  const match = raw.trim().match(/^([A-Za-z][A-Za-z0-9]*)[-_\s]?(\d+)$/);
  if (!match) return null;
  return {
    workspaceKey: match[1].toUpperCase(),
    itemNumber: Number.parseInt(match[2], 10),
  };
}

/**
 * Like parseItemKey, but also accepts a bare item number ("123") when the
 * admin configured a default workspace key on the connection.
 */
async function parseQueryItemKey(
  ctx: IntegrationResourceContext,
  raw: string,
): Promise<{ workspaceKey: string; itemNumber: number } | null> {
  const direct = parseItemKey(raw);
  if (direct) return direct;
  if (!/^\d+$/.test(raw)) return null;
  const { defaultWorkspaceKey } = await ctx.client.settings();
  if (!defaultWorkspaceKey) return null;
  return {
    workspaceKey: defaultWorkspaceKey,
    itemNumber: Number.parseInt(raw, 10),
  };
}

function collectionKey(collection: WindshiftCollection): string {
  return collection.slug && collection.slug.length > 0
    ? collection.slug
    : String(collection.id);
}

const REPORT_PAGE_SIZE = 50;
const REPORT_MAX_PAGE = 1000;

/** Clamps the view-supplied `params.page` to a sane 1-based page number. */
function reportPage(params: Record<string, unknown> | undefined): number {
  const raw = params?.page;
  const page = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, REPORT_MAX_PAGE);
}

export const WINDSHIFT_RESOURCES: IntegrationResourceManifest[] = [
  {
    id: 'item',
    title: 'Windshift item',
    description: 'Embed a live Windshift item card.',
    renderKind: 'item-card',
    searchTerms: ['windshift', 'item', 'ticket', 'task'],
    picker: {
      placeholder: 'Search by title or paste WI-123',
      emptyLabel: 'No matching items',
    },
    menu: {
      title: 'Windshift item',
      description: 'Embed a live Windshift item card',
      searchTerms: ['windshift', 'item', 'ticket', 'task'],
      icon: 'link',
    },
    urlPatterns: [
      {
        pattern: '/workspaces/\\d+/items/(?<id>\\d+)',
        resourceKey: 'id:{id}',
      },
    ],
    security: {
      outboundPaths: [
        '/rest/api/v1/search/items',
        '/rest/api/v1/workspaces/:workspaceKey/items/:itemNumber',
        '/rest/api/v1/items/:id',
      ],
    },
    async search(ctx, args) {
      const q = args.q?.trim() ?? '';
      if (!q) return [];

      const parsed = await parseQueryItemKey(ctx, q);
      if (parsed) {
        const key = `${parsed.workspaceKey}-${parsed.itemNumber}`;
        return [{ key, title: key, badge: key }];
      }

      // Personal-workspace items must never surface on a shared page; the
      // API enforces this server-side via exclude_personal.
      const body = await ctx.client.get<{ data?: WindshiftItem[] }>(
        '/rest/api/v1/search/items',
        { q, limit: args.limit ?? 10, exclude_personal: 'true' },
      );
      return (body.data ?? []).map(normalizeItemSearch);
    },
    async resolve(ctx, args) {
      let item: WindshiftItem;
      const idHint = args.resourceKey.startsWith('id:')
        ? Number.parseInt(args.resourceKey.slice(3), 10)
        : undefined;
      if (idHint && Number.isFinite(idHint)) {
        item = await ctx.client.get<WindshiftItem>(
          `/rest/api/v1/items/${encodeURIComponent(String(idHint))}`,
          { exclude_personal: 'true' },
        );
      } else {
        const parsed = parseItemKey(args.resourceKey);
        if (!parsed) {
          const err = new Error('Invalid Windshift item key');
          (err as Error & { status?: number }).status = 400;
          throw err;
        }
        item = await ctx.client.get<WindshiftItem>(
          `/rest/api/v1/workspaces/${encodeURIComponent(parsed.workspaceKey)}/items/${encodeURIComponent(String(parsed.itemNumber))}`,
          { exclude_personal: 'true' },
        );
      }
      const baseUrl = await ctx.client.baseUrl();
      return normalizeItemCard(baseUrl, item);
    },
  },
  {
    id: 'collectionReport',
    title: 'Windshift report',
    description: 'Embed a live Windshift collection report.',
    renderKind: 'table-report',
    searchTerms: ['windshift', 'report', 'collection', 'table'],
    picker: {
      placeholder: 'Search collections by name…',
      emptyLabel: 'No matching collections',
      searchOnEmpty: true,
    },
    menu: {
      title: 'Windshift report',
      description: 'Embed a live Windshift collection report',
      searchTerms: ['windshift', 'report', 'collection', 'table'],
      icon: 'table',
    },
    security: {
      outboundPaths: [
        '/rest/api/v1/collections',
        '/rest/api/v1/collections/:key',
        '/rest/api/v1/collections/:key/items',
      ],
    },
    async search(ctx, args) {
      const query: Record<string, string | number | undefined> = {
        limit: args.limit ?? 10,
      };
      if (args.q) query.q = args.q;
      const body = await ctx.client.get<{
        items?: WindshiftCollection[];
        data?: WindshiftCollection[];
      }>('/rest/api/v1/collections', query);
      return (body.items ?? body.data ?? []).map((collection) => ({
        key: collectionKey(collection),
        title: collection.name,
        subtitle: collection.description,
        badge: collection.slug,
      }));
    },
    async resolve(ctx, args) {
      const key = args.resourceKey;
      const page = reportPage(args.params);
      const collection = await ctx.client.get<WindshiftCollection>(
        `/rest/api/v1/collections/${encodeURIComponent(key)}`,
      );
      const body = await ctx.client.get<{
        data?: WindshiftItem[];
        pagination?: { total?: number; has_more?: boolean };
      }>(`/rest/api/v1/collections/${encodeURIComponent(key)}/items`, {
        page,
        limit: REPORT_PAGE_SIZE,
        exclude_personal: 'true',
      });
      const rows = body.data ?? [];
      const baseUrl = await ctx.client.baseUrl();
      const payload: IntegrationTableReportPayload = {
        kind: 'table-report',
        title: collection.name,
        description: collection.description,
        total: body.pagination?.total ?? rows.length,
        page,
        hasMore: body.pagination?.has_more ?? false,
        rows: rows.map((item) => ({
          id: String(item.id),
          key: itemKey(item),
          title: item.title,
          url: itemUrl(baseUrl, item),
          status: item.status?.name,
          assignee: item.assignee?.full_name ?? item.assignee?.email,
        })),
      };
      return payload;
    },
  },
];
