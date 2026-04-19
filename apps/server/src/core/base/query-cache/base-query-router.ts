import { Injectable } from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';

export type RouteDecision = 'postgres' | 'cache';

@Injectable()
export class BaseQueryRouter {
  constructor(private readonly configProvider: QueryCacheConfigProvider) {}

  // Stubbed: routes always to postgres in this commit so the existing
  // behavior is preserved. Real decision logic is added in task 6.
  decide(_args: unknown): RouteDecision {
    if (!this.configProvider.config.enabled) return 'postgres';
    return 'postgres';
  }
}
