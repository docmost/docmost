import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getWorkspacePageAnalyticsDailyStats,
  getWorkspacePageAnalyticsTopPages,
  getWorkspacePageAnalyticsTotals,
} from "@/ee/page-analytics/services/page-analytics-service";
import type { IPagination } from "@/lib/types";
import type {
  WorkspaceAnalyticsDailyStat,
  WorkspaceAnalyticsListParams,
  WorkspaceAnalyticsParams,
  WorkspaceAnalyticsTopPage,
  WorkspaceAnalyticsTotals,
} from "@/ee/page-analytics/types/page-analytics.types";

export function useWorkspacePageAnalyticsTotalsQuery(
  params?: WorkspaceAnalyticsParams,
) {
  return useQuery<WorkspaceAnalyticsTotals, Error>({
    queryKey: ["workspace-page-analytics-totals", params],
    queryFn: () => getWorkspacePageAnalyticsTotals(params),
    placeholderData: keepPreviousData,
  });
}

export function useWorkspacePageAnalyticsDailyStatsQuery(
  params?: WorkspaceAnalyticsListParams,
) {
  return useQuery<IPagination<WorkspaceAnalyticsDailyStat>, Error>({
    queryKey: ["workspace-page-analytics-daily-stats", params],
    queryFn: () => getWorkspacePageAnalyticsDailyStats(params),
    placeholderData: keepPreviousData,
  });
}

export function useWorkspacePageAnalyticsTopPagesQuery(
  params?: WorkspaceAnalyticsListParams,
) {
  return useQuery<IPagination<WorkspaceAnalyticsTopPage>, Error>({
    queryKey: ["workspace-page-analytics-top-pages", params],
    queryFn: () => getWorkspacePageAnalyticsTopPages(params),
    placeholderData: keepPreviousData,
  });
}
