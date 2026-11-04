import { OAuthConfig } from '../registry/integration-provider.interface';

// Products on one authorization server (Atlassian, Google) share credentials via credentialsKey
export function credentialEnvKey(
  field: 'CLIENT_ID' | 'CLIENT_SECRET',
  type: string,
  oauthConfig?: Pick<OAuthConfig, 'credentialsKey'>,
): string {
  const key = oauthConfig?.credentialsKey ?? type;
  return `INTEGRATION_${key.toUpperCase()}_${field}`;
}
