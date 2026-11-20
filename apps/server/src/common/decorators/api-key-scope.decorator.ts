import { SetMetadata } from '@nestjs/common';

export const API_KEY_SCOPE_KEY = 'apiKeyScope';

export type ApiKeyRouteScope = 'read' | 'write';

// Read on handlers only. Routes without this (or @OAuthScope) need a key with write scope.
export const ApiKeyScope = (scope: ApiKeyRouteScope) =>
  SetMetadata(API_KEY_SCOPE_KEY, scope);
