import { Injectable, Optional } from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import type { FilterNode, SearchSpec, SortSpec } from '../engine';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { BaseQueryCacheService } from './base-query-cache.service';

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
    private readonly cacheService: BaseQueryCacheService,
    @Optional() private readonly env: EnvironmentService | null = null,
  ) {}

  async decide(args: RouteDecideArgs): Promise<RouteDecision> {
    const { enabled, minRows } = this.configProvider.config;
    const trace = this.configProvider.config.trace ?? false;
    const debug = this.env?.getBaseQueryCacheDebug() ?? false;
    const tStart = debug ? Date.now() : 0;

    const emit = (route: RouteDecision, reason: string): RouteDecision => {
      if (trace) {
        console.log(
          '[cache-trace]',
          JSON.stringify({
            phase: 'router.decision',
            baseId: args.baseId,
            route,
            reason,
          }),
        );
      }
      return route;
    };

    if (!enabled) return emit('postgres', 'flag disabled');

    const hasFilter = !!args.filter;
    const hasSorts = !!args.sorts && args.sorts.length > 0;
    const hasSearch = !!args.search;
    if (!hasFilter && !hasSorts && !hasSearch) {
      return emit('postgres', 'no filter/sort/search');
    }

    // v1: any search stays on Postgres — loader doesn't populate search_text yet.
    if (hasSearch) return emit('postgres', 'search requires postgres');

    // Fast path: if the collection is already resident, read the cached
    // row count instead of running a Postgres COUNT on every request.
    const tPeek = debug ? Date.now() : 0;
    const resident = this.cacheService.peek(args.baseId);
    const peekMs = debug ? Date.now() - tPeek : 0;
    if (resident) {
      if (debug) {
        console.log(
          '[cache-perf]',
          JSON.stringify({
            phase: 'router.residentCount',
            baseId: args.baseId.slice(0, 8),
            count: resident.rowCount,
            minRows,
            ms: peekMs,
            totalMs: Date.now() - tStart,
          }),
        );
      }
      if (resident.rowCount < minRows) {
        return emit(
          'postgres',
          `rowCount=${resident.rowCount} below MIN_ROWS=${minRows}`,
        );
      }
      return emit(
        'cache',
        `qualified: rowCount=${resident.rowCount}, hasFilter=${hasFilter}, hasSort=${hasSorts}`,
      );
    }

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
          ms: Date.now() - tCount,
          totalMs: Date.now() - tStart,
        }),
      );
    }
    if (count < minRows) {
      return emit('postgres', `rowCount=${count} below MIN_ROWS=${minRows}`);
    }

    return emit(
      'cache',
      `qualified: rowCount=${count}, hasFilter=${hasFilter}, hasSort=${hasSorts}`,
    );
  }
}
