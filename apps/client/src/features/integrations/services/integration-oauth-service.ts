import api from "@/lib/api-client";
import { IntegrationListItem } from "@/features/integrations/types/integration.types";

export async function listIntegrations(): Promise<IntegrationListItem[]> {
  return api.get<unknown, IntegrationListItem[]>("/integrations/oauth");
}

export async function disconnectIntegration(
  integrationId: string,
): Promise<void> {
  await api.delete(`/integrations/oauth/${integrationId}/connection`);
}

/**
 * Returns the authorize URL — caller does a top-level navigation so the
 * provider's redirect comes back into our window. Same shape window.location
 * expects, no JSON wrapping.
 */
export function authorizeUrl(integrationId: string, returnTo?: string): string {
  const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  return `/api/integrations/oauth/${integrationId}/authorize${qs}`;
}
