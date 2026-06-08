import api from "@/lib/api-client";

export type IntegrationResourceRenderKind = "item-card" | "table-report";

export interface IntegrationResourceSearchResult {
  key: string;
  title: string;
  subtitle?: string;
  badge?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationItemCardPayload {
  kind: "item-card";
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
  kind: "table-report";
  title: string;
  description?: string;
  total?: number;
  rows: IntegrationTableReportRow[];
  page?: number;
  hasMore?: boolean;
}

export type IntegrationResolvedResource = IntegrationItemCardPayload | IntegrationTableReportPayload;

function resourcePath(integrationId: string, resourceId: string, action: "search" | "resolve"): string {
  return `/integrations/${encodeURIComponent(integrationId)}/resources/${encodeURIComponent(resourceId)}/${action}`;
}

export async function searchIntegrationResource(args: {
  integrationId: string;
  resourceId: string;
  q?: string;
  limit?: number;
}): Promise<IntegrationResourceSearchResult[]> {
  const params = new URLSearchParams();
  if (args.q) params.set("q", args.q);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  const req = await api.get<{ items?: IntegrationResourceSearchResult[] }>(
    `${resourcePath(args.integrationId, args.resourceId, "search")}${qs ? `?${qs}` : ""}`,
  );
  return req.data.items ?? [];
}

export async function resolveIntegrationResource(args: {
  integrationId: string;
  resourceId: string;
  resourceKey: string;
  params?: Record<string, unknown> | null;
}): Promise<IntegrationResolvedResource> {
  const params = new URLSearchParams({ key: args.resourceKey });
  if (args.params) params.set("params", JSON.stringify(args.params));
  const req = await api.get<IntegrationResolvedResource>(
    `${resourcePath(args.integrationId, args.resourceId, "resolve")}?${params.toString()}`,
  );
  return req.data;
}
