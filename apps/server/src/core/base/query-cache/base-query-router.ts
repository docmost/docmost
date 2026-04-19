import { Injectable, Optional } from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import type { FilterNode, SearchSpec, SortSpec } from '../engine';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

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
    @Optional() private readonly env: EnvironmentService | null = null,
  ) {}

  async decide(args: RouteDecideArgs): Promise<RouteDecision> {
    const { enabled, minRows } = this.configProvider.config;
    if (!enabled) return 'postgres';

    const hasFilter = !!args.filter;
    const hasSorts = !!args.sorts && args.sorts.length > 0;
    const hasSearch = !!args.search;
    if (!hasFilter && !hasSorts && !hasSearch) return 'postgres';

    // v1: any search stays on Postgres — loader doesn't populate search_text yet.
    if (hasSearch) return 'postgres';

    const debug = this.env?.getBaseQueryCacheDebug() ?? false;
    const tCount = debug ? Date.now() : 0;
    const count = await this.baseRowRepo.countActiveRows(args.baseId, {
      workspaceId: args.workspaceId,
    });
    if (debug) {
      console.log(
        '[cache-perf]',
        JSON.stringify({
          phase: 'router.countActiveRows',
          baseId: args.baseId.slice(0, 8),
          countMs: Date.now() - tCount,
          count,
          minRows,
        }),
      );
    }
    if (count < minRows) return 'postgres';

    return 'cache';
  }
}
