import { SSO_PROVIDER } from "@/ee/security/contants.ts";
import { getAppUrl, getServerAppUrl } from "@/lib/config.ts";

export function buildCallbackUrl(opts: {
  providerId: string;
  type: SSO_PROVIDER;
}): string {
  const { providerId, type } = opts;
  const domain = getAppUrl();

  if (type === SSO_PROVIDER.GOOGLE) {
    return `${domain}/api/sso/${type}/callback`;
  }

  // Azure AD (Entra ID) uses a fixed, singleton callback URL (no providerId
  // segment) - Entra app registrations require an exact, unchanging redirect
  // URI. Generic OIDC keeps the providerId-scoped route.
  if (type === SSO_PROVIDER.AZURE_AD) {
    return `${domain}/api/sso/oidc/callback`;
  }

  return `${domain}/api/sso/${type}/${providerId}/callback`;
}

export function buildSsoLoginUrl(opts: {
  providerId: string;
  type: SSO_PROVIDER;
  workspaceId?: string;
  redirect?: string;
}): string {
  const { providerId, type, workspaceId, redirect } = opts;
  const domain = getAppUrl();

  const params = new URLSearchParams();
  if (redirect) params.set("redirect", redirect);

  if (type === SSO_PROVIDER.GOOGLE) {
    if (workspaceId) params.set("workspaceId", workspaceId);
    return `${getServerAppUrl()}/api/sso/${type}/login?${params.toString()}`;
  }

  const query = params.toString();

  // Azure AD (Entra ID) uses the singleton login route (no providerId) to
  // match its fixed callback URL. Generic OIDC keeps the providerId-scoped
  // route.
  if (type === SSO_PROVIDER.AZURE_AD) {
    const base = `${domain}/api/sso/oidc/login`;
    return query ? `${base}?${query}` : base;
  }

  const base = `${domain}/api/sso/${type}/${providerId}/login`;
  return query ? `${base}?${query}` : base;
}

export function getGoogleSignupUrl(): string {
  // Google login is instance-wide. Use the env APP_URL instead
  return `${getServerAppUrl()}/api/sso/${SSO_PROVIDER.GOOGLE}/signup`;
}

export function buildSamlEntityId(providerId: string): string {
  const domain = getAppUrl();
  return `${domain}/api/sso/${SSO_PROVIDER.SAML}/${providerId}/login`;
}
