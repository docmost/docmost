import api from "@/lib/api-client";

export interface IOidcStatus {
  enabled: boolean;
  autoProvision: boolean;
}

export async function getOidcStatus(): Promise<IOidcStatus> {
  const response = await api.get<IOidcStatus>("/auth/oidc/status");
  return response.data;
}

export function getOidcLoginUrl(): string {
  return `${window.location.origin}/api/auth/oidc/login`;
}
