export type IntegrationResourceRenderKind = 'item-card' | 'table-report';

export interface IntegrationResourcePickerManifest {
  placeholder?: string;
  emptyLabel?: string;
  searchOnEmpty?: boolean;
}

export interface IntegrationResourceMenuManifest {
  title: string;
  description?: string;
  searchTerms?: string[];
  icon?: 'link' | 'table';
}

export interface IntegrationResourceSearchResult {
  /** Stable provider-owned key persisted in the editor node. */
  key: string;
  title: string;
  subtitle?: string;
  badge?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationItemCardPayload {
  kind: 'item-card';
  key: string;
  title: string;
  url?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationTableReportRow {
  id: string;
  key?: string;
  title: string;
  url?: string;
  status?: string;
  assignee?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationTableReportPayload {
  kind: 'table-report';
  title: string;
  description?: string;
  total?: number;
  rows: IntegrationTableReportRow[];
  /**
   * 1-based page this payload covers. Resolve is re-invoked with
   * `params: { page }` when the view loads more rows; providers that
   * support paging read it and set `hasMore` accordingly.
   */
  page?: number;
  /** True when rows exist beyond this page — enables the Load more control. */
  hasMore?: boolean;
}

export type IntegrationResolvedResource =
  | IntegrationItemCardPayload
  | IntegrationTableReportPayload;

/**
 * Outbound provider access scoped to one (integration, workspace, user,
 * resource). GET-only, and every path must match one of the resource's
 * declared `security.outboundPaths` — the framework rejects anything else.
 */
export interface IntegrationResourceClient {
  get<T = unknown>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<T>;
  /** Resolved connection base URL — for building display links. */
  baseUrl(): Promise<string>;
  /** Admin-configured connection settings declared by the manifest. */
  settings(): Promise<Record<string, string>>;
}

export interface IntegrationResourceContext {
  integrationId: string;
  workspaceId: string;
  userId: string;
  client: IntegrationResourceClient;
}

export interface IntegrationResourceSearchArgs {
  q?: string;
  limit?: number;
}

export interface IntegrationResourceResolveArgs {
  resourceKey: string;
  params?: Record<string, unknown>;
}

/**
 * Paste-to-embed URL pattern, matched client-side against text typed or
 * pasted into the editor. `pattern` is a regex source applied after the
 * connection's base URL; capture provider keys with named groups and
 * reference them in `resourceKey` as `{name}`.
 */
export interface IntegrationResourceUrlPattern {
  pattern: string;
  /** e.g. 'id:{id}' */
  resourceKey: string;
}

/**
 * Declarative, safe resource surface exposed to the editor. Providers own all
 * outbound paths and normalization here; the generic controller never accepts
 * arbitrary provider paths, methods, or unvetted query forwarding.
 */
export interface IntegrationResourceManifest {
  id: string;
  title: string;
  description?: string;
  renderKind: IntegrationResourceRenderKind;
  searchTerms?: string[];
  picker?: IntegrationResourcePickerManifest;
  menu?: IntegrationResourceMenuManifest;
  /** Provider URLs that auto-convert to embeds when pasted in the editor. */
  urlPatterns?: IntegrationResourceUrlPattern[];
  /**
   * Enforced outbound allowlist: `search`/`resolve` may only GET paths
   * matching these patterns (`:param` segments match one path segment).
   * A resource that declares none cannot reach the provider at all.
   */
  security?: {
    outboundPaths: string[];
  };
  search?: (
    ctx: IntegrationResourceContext,
    args: IntegrationResourceSearchArgs,
  ) => Promise<IntegrationResourceSearchResult[]>;
  resolve: (
    ctx: IntegrationResourceContext,
    args: IntegrationResourceResolveArgs,
  ) => Promise<IntegrationResolvedResource>;
}

export interface PublicIntegrationResourceManifest {
  id: string;
  title: string;
  description?: string;
  renderKind: IntegrationResourceRenderKind;
  searchTerms: string[];
  picker?: IntegrationResourcePickerManifest;
  menu?: IntegrationResourceMenuManifest;
  urlPatterns?: IntegrationResourceUrlPattern[];
}

export function toPublicResourceManifest(
  resource: IntegrationResourceManifest,
): PublicIntegrationResourceManifest {
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    renderKind: resource.renderKind,
    searchTerms: resource.searchTerms ?? [],
    picker: resource.picker,
    menu: resource.menu,
    urlPatterns: resource.urlPatterns,
  };
}
