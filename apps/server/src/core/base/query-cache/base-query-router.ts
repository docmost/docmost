import { Injectable } from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import type { FilterNode, SearchSpec, SortSpec } from '../engine';

export type RouteDecision = 'postgres' | 'cache';

export type RouteDecideArgs = {
  baseId: string;
  workspaceId: string;
  filter?: FilterNode;
  sorts?: SortSpec[];
  search?: SearchSpec;
};

@Injectable()
export class BaseQueryRouter {
  constructor(
    private readonly configProvider: QueryCacheConfigProvider,
    private readonly baseRowRepo: BaseRowRepo,
  ) {}

  async decide(args: RouteDecideArgs): Promise<RouteDecision> {
    const { enabled, minRows } = this.configProvider.config;
    if (!enabled) return 'postgres';

    const hasFilter = !!args.filter;
    const hasSorts = !!args.sorts && args.sorts.length > 0;
    const hasSearch = !!args.search;
    if (!hasFilter && !hasSorts && !hasSearch) return 'postgres';

    // v1: any search stays on Postgres. Trgm search also stays on Postgres
    // until the loader populates `search_text`; re-evaluate after that lands.
    if (args.search) return 'postgres';

    const count = await this.baseRowRepo.countActiveRows(args.baseId, {
      workspaceId: args.workspaceId,
    });
    if (count < minRows) return 'postgres';

    return 'cache';
  }
}
