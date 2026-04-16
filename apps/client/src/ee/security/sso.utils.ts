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
  return `${domain}/api/sso/${type}/${providerId}/callback`;
}

export function buildSsoLoginUrl(opts: {
  providerId: string;
  type: SSO_PROVIDER;
  redirect?: string;
  workspaceId?: string;
}): string {
  const { providerId, type, workspaceId, redirect } = opts;
  const domain = getAppUrl();

  const url =
    type === SSO_PROVIDER.GOOGLE
      ? new URL(`/api/sso/${type}/login`, getServerAppUrl())
      : new URL(`/api/sso/${type}/${providerId}/login`, domain);

  if (workspaceId) {
    url.searchParams.set("workspaceId", workspaceId);
  }

  if (redirect) {
    url.searchParams.set("redirect", redirect);
  }

  return url.toString();
}

export function getGoogleSignupUrl(): string {
  // Google login is instance-wide. Use the env APP_URL instead
  return `${getServerAppUrl()}/api/sso/${SSO_PROVIDER.GOOGLE}/signup`;
}

export function buildSamlEntityId(providerId: string): string {
  const domain = getAppUrl();
  return `${domain}/api/sso/${SSO_PROVIDER.SAML}/${providerId}/login`;
}
