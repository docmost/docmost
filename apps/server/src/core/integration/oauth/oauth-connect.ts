import { OAuthConfig } from '../registry/integration-provider.interface';

// Workspace-scoped providers can only connect through the identity flow
export function supportsOAuthConnect(
  oauth: OAuthConfig | undefined,
): boolean {
  if (!oauth) return false;
  return (oauth.connectionScope ?? 'user') === 'user' || !!oauth.identity;
}
