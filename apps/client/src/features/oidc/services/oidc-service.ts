import api from "@/lib/api-client";
import {
  ICreateOidcProvider,
  IOidcProvider,
  IUpdateOidcProvider,
} from "@/features/oidc/types/oidc.types.ts";

export async function getOidcProviders(): Promise<IOidcProvider[]> {
  const req = await api.get<IOidcProvider[]>("/oidc/providers");
  return req.data;
}

export async function createOidcProvider(
  data: ICreateOidcProvider,
): Promise<IOidcProvider> {
  const req = await api.post<IOidcProvider>("/oidc/providers", data);
  return req.data;
}

export async function updateOidcProvider(
  providerId: string,
  data: IUpdateOidcProvider,
): Promise<IOidcProvider> {
  const req = await api.patch<IOidcProvider>(`/oidc/providers/${providerId}`, data);
  return req.data;
}

export async function enableOidcProvider(
  providerId: string,
): Promise<IOidcProvider> {
  const req = await api.post<IOidcProvider>(`/oidc/providers/${providerId}/enable`);
  return req.data;
}

export async function disableOidcProvider(
  providerId: string,
): Promise<IOidcProvider> {
  const req = await api.post<IOidcProvider>(`/oidc/providers/${providerId}/disable`);
  return req.data;
}

export function redirectToOidcLogin(slug: string, redirect?: string) {
  const url = new URL(`/api/oidc/${slug}/start`, window.location.origin);
  if (redirect) {
    url.searchParams.set("redirect", redirect);
  }

  window.location.assign(url.toString());
}
