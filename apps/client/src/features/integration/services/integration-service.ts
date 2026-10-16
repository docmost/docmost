import api from "@/lib/api-client";
import {
  IntegrationDefinition,
  Integration,
  UserConnection,
  UnfurlResult,
  UnfurlNeedsConnection,
} from "../types/integration.types";

export async function getAvailableIntegrations(): Promise<
  IntegrationDefinition[]
> {
  const req = await api.post<IntegrationDefinition[]>(
    "/integrations/available",
  );
  return req.data;
}

export async function getInstalledIntegrations(): Promise<Integration[]> {
  const req = await api.post<Integration[]>("/integrations");
  return req.data;
}

export async function uninstallIntegration(data: {
  integrationId: string;
}): Promise<void> {
  await api.post("/integrations/uninstall", data);
}

export async function getMyConnections(): Promise<UserConnection[]> {
  const req = await api.post<UserConnection[]>("/integrations/connections");
  return req.data;
}

export async function getOAuthAuthorizeUrl(data: {
  integrationId: string;
  returnPath?: string;
}): Promise<{ authorizationUrl: string }> {
  const req = await api.post<{ authorizationUrl: string }>(
    "/integrations/oauth/authorize",
    data,
  );
  return req.data;
}

// The integration row is only created when the OAuth callback succeeds.
export async function getOAuthInstallUrl(data: {
  type: string;
}): Promise<{ authorizationUrl: string }> {
  const req = await api.post<{ authorizationUrl: string }>(
    "/integrations/oauth/install",
    data,
  );
  return req.data;
}

export async function disconnectIntegration(data: {
  integrationId: string;
}): Promise<void> {
  await api.post("/integrations/oauth/disconnect", data);
}

export async function unfurlUrl(data: {
  url: string;
}): Promise<UnfurlResult | UnfurlNeedsConnection | null> {
  const req = await api.post<{
    data: UnfurlResult | UnfurlNeedsConnection | null;
  }>("/integrations/unfurl", data);
  return req.data.data;
}
