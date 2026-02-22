import api from "@/lib/api-client";
import {
  IntegrationDefinition,
  Integration,
  ConnectionStatus,
  UnfurlResult,
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
  const req = await api.post<Integration[]>("/integrations/list");
  return req.data;
}

export async function installIntegration(data: {
  type: string;
}): Promise<Integration> {
  const req = await api.post<Integration>("/integrations/install", data);
  return req.data;
}

export async function uninstallIntegration(data: {
  integrationId: string;
}): Promise<void> {
  await api.post("/integrations/uninstall", data);
}

export async function updateIntegrationSettings(data: {
  integrationId: string;
  settings?: Record<string, any>;
  isEnabled?: boolean;
}): Promise<Integration> {
  const req = await api.post<Integration>("/integrations/update", data);
  return req.data;
}

export async function getConnectionStatus(data: {
  integrationId: string;
}): Promise<ConnectionStatus> {
  const req = await api.post<ConnectionStatus>(
    "/integrations/connection/status",
    data,
  );
  return req.data;
}

export async function getOAuthAuthorizeUrl(data: {
  integrationId: string;
}): Promise<{ authorizationUrl: string }> {
  const req = await api.post<{ authorizationUrl: string }>(
    "/integrations/oauth/authorize",
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
}): Promise<UnfurlResult | null> {
  const req = await api.post<{ data: UnfurlResult | null }>(
    "/integrations/unfurl",
    data,
  );
  return req.data.data;
}
