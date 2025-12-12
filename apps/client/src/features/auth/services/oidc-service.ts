import api from "@/lib/api-client";

export interface IOidcConfig {
  buttonText: string;
  autoRedirect: boolean;
}

export interface IOidcAuthUrl {
  url: string;
}

export interface IOidcProvider {
  id: string;
  name: string;
  type: string;
  oidcIssuer: string;
  oidcClientId: string;
  scope: string;
  allowSignup: boolean;
  isEnabled: boolean;
  oidcAllowedGroups?: string;
  oidcAvatarAttribute?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateOidcProvider {
  name: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  scope: string;
  allowSignup?: boolean;
  isEnabled?: boolean;
  enforceSso?: boolean;
  oidcAllowedGroups?: string;
  oidcAvatarAttribute?: string;
}

export interface IUpdateOidcProvider {
  name?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  scope?: string;
  allowSignup?: boolean;
  isEnabled?: boolean;
  enforceSso?: boolean;
  oidcAllowedGroups?: string;
  oidcAvatarAttribute?: string;
}

export async function getOidcConfig(): Promise<IOidcConfig> {
  const req = await api.get<IOidcConfig>("/auth/oidc/config");
  return req.data;
}

export async function getOidcAuthUrl(): Promise<IOidcAuthUrl> {
  const req = await api.get<IOidcAuthUrl>("/auth/oidc/authorize");
  return req.data;
}

export async function getOidcProvider(): Promise<IOidcProvider> {
  const req = await api.get<IOidcProvider>("/auth/oidc/provider");
  return req.data;
}

export async function createOidcProvider(
  data: ICreateOidcProvider
): Promise<IOidcProvider> {
  const req = await api.post<IOidcProvider>("/auth/oidc/provider", data);
  return req.data;
}

export async function updateOidcProvider(
  id: string,
  data: IUpdateOidcProvider
): Promise<IOidcProvider> {
  const req = await api.put<IOidcProvider>(`/auth/oidc/provider/${id}`, data);
  return req.data;
}

export async function deleteOidcProvider(id: string): Promise<void> {
  await api.delete(`/auth/oidc/provider/${id}`);
}
