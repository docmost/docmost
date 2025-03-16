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
  workspaceId?: string;
}): string {
  const { providerId, type, workspaceId } = opts;
  const domain = getAppUrl();

  if (type === SSO_PROVIDER.GOOGLE) {
    return `${getServerAppUrl()}/api/sso/${type}/login?workspaceId=${workspaceId}`;
  }
  return `${domain}/api/sso/${type}/${providerId}/login`;
}

export function getGoogleSignupUrl(): string {
  // Google login is instance-wide. Use the env APP_URL instead
  return `${getServerAppUrl()}/api/sso/${SSO_PROVIDER.GOOGLE}/signup`;
}

export function buildSamlEntityId(providerId: string): string {
  const domain = getAppUrl();
  return `${domain}/api/sso/${SSO_PROVIDER.SAML}/${providerId}/login`;
}
