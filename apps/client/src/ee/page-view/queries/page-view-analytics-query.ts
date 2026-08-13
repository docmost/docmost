import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getWorkspacePageViewDailyStats,
  getWorkspacePageViewTopPages,
  getWorkspacePageViewTotals,
} from "@/ee/page-view/services/page-view-analytics-service";
import type { IPagination } from "@/lib/types";
import type {
  WorkspaceAnalyticsDailyStat,
  WorkspaceAnalyticsListParams,
  WorkspaceAnalyticsParams,
  WorkspaceAnalyticsTopPage,
  WorkspaceAnalyticsTotals,
} from "@/ee/page-view/types/page-view-analytics.types";

export function useWorkspacePageViewTotalsQuery(
  params?: WorkspaceAnalyticsParams,
) {
  return useQuery<WorkspaceAnalyticsTotals, Error>({
    queryKey: ["workspace-page-view-totals", params],
    queryFn: () => getWorkspacePageViewTotals(params),
    placeholderData: keepPreviousData,
  });
}

export function useWorkspacePageViewDailyStatsQuery(
  params?: WorkspaceAnalyticsListParams,
) {
  return useQuery<IPagination<WorkspaceAnalyticsDailyStat>, Error>({
    queryKey: ["workspace-page-view-daily-stats", params],
    queryFn: () => getWorkspacePageViewDailyStats(params),
    placeholderData: keepPreviousData,
  });
}

export function useWorkspacePageViewTopPagesQuery(
  params?: WorkspaceAnalyticsListParams,
) {
  return useQuery<IPagination<WorkspaceAnalyticsTopPage>, Error>({
    queryKey: ["workspace-page-view-top-pages", params],
    queryFn: () => getWorkspacePageViewTopPages(params),
    placeholderData: keepPreviousData,
  });
}
