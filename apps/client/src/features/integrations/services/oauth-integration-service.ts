import api from "@/lib/api-client";
import { IOAuthAppConfig, IOAuthConnectionStatus } from "../types";

// Generic client for the server's provider-agnostic OAuth2 endpoints
// (/integrations/oauth2/:provider/...). Reused by every OAuth2 integration.
const base = (provider: string) => `/integrations/oauth2/${provider}`;

export async function getOAuthAuthorizeUrl(
  provider: string,
): Promise<{ url: string | null }> {
  const req = await api.post<{ url: string | null }>(
    `${base(provider)}/authorize`,
  );
  return req.data;
}

export async function getOAuthConnectionStatus(
  provider: string,
): Promise<IOAuthConnectionStatus> {
  const req = await api.post<IOAuthConnectionStatus>(`${base(provider)}/status`);
  return req.data;
}

export async function disconnectOAuthIntegration(
  provider: string,
): Promise<void> {
  await api.post(`${base(provider)}/disconnect`);
}

export async function getOAuthAppConfig(
  provider: string,
): Promise<IOAuthAppConfig> {
  const req = await api.post<IOAuthAppConfig>(`${base(provider)}/config`);
  return req.data;
}

export async function setOAuthAppConfig(
  provider: string,
  input: { clientId: string; clientSecret: string },
): Promise<void> {
  await api.post(`${base(provider)}/config/set`, input);
}

export async function deleteOAuthAppConfig(provider: string): Promise<void> {
  await api.post(`${base(provider)}/config/delete`);
}
