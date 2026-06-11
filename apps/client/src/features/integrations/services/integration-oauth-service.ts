import api from "@/lib/api-client";
import {
  IntegrationListItem,
  IntegrationOAuthConnection,
  SaveIntegrationOAuthConnectionInput,
} from "@/features/integrations/types/integration.types";

export async function listIntegrations(): Promise<IntegrationListItem[]> {
  const req = await api.get<IntegrationListItem[]>("/integrations/oauth");
  return req.data;
}

export async function disconnectIntegration(
  integrationId: string,
): Promise<void> {
  await api.delete(
    `/integrations/oauth/${encodeURIComponent(integrationId)}/connection`,
  );
}

export async function listIntegrationConnections(): Promise<
  IntegrationOAuthConnection[]
> {
  const req = await api.get<IntegrationOAuthConnection[]>(
    "/integrations/oauth/admin/connections",
  );
  return req.data;
}

export async function saveIntegrationConnection(
  integrationId: string,
  input: SaveIntegrationOAuthConnectionInput,
): Promise<IntegrationOAuthConnection> {
  const req = await api.put<IntegrationOAuthConnection>(
    `/integrations/oauth/admin/connections/${encodeURIComponent(integrationId)}`,
    input,
  );
  return req.data;
}

/**
 * Returns the authorize URL — caller does a top-level navigation so the
 * provider's redirect comes back into our window. Same shape window.location
 * expects, no JSON wrapping.
 */
export function authorizeUrl(integrationId: string, returnTo?: string): string {
  const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  return `/api/integrations/oauth/${encodeURIComponent(integrationId)}/authorize${qs}`;
}
