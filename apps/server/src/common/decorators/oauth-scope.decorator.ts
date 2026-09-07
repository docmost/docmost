import { SetMetadata } from '@nestjs/common';

export const OAUTH_SCOPE_KEY = 'oauthScope';

export type OAuthRouteScope = 'read' | 'write';

export const OAuthScope = (scope: OAuthRouteScope) =>
  SetMetadata(OAUTH_SCOPE_KEY, scope);
