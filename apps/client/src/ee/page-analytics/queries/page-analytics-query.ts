import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPageAnalyticsRetention,
  getWorkspacePageAnalyticsDailyStats,
  getWorkspacePageAnalyticsTopPages,
  getWorkspacePageAnalyticsTotals,
  updatePageAnalyticsRetention,
} from "@/ee/page-analytics/services/page-analytics-service";
import type { IPagination } from "@/lib/types";
import type {
  WorkspaceAnalyticsDailyStat,
  WorkspaceAnalyticsListParams,
  WorkspaceAnalyticsParams,
  WorkspaceAnalyticsTopPage,
  WorkspaceAnalyticsTotals,
} from "@/ee/page-analytics/types/page-analytics.types";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";

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

export function usePageAnalyticsRetentionQuery() {
  return useQuery({
    queryKey: ["page-analytics-retention"],
    queryFn: () => getPageAnalyticsRetention(),
  });
}

export function useUpdatePageAnalyticsRetentionMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: { pageAnalyticsRetentionDays: number }) =>
      updatePageAnalyticsRetention(data),
    onSuccess: () => {
      notifications.show({ message: t("Page analytics retention updated") });
      queryClient.invalidateQueries({ queryKey: ["page-analytics-retention"] });
    },
    onError: (error) => {
      const errorMessage = error["response"]?.data?.message;
      notifications.show({ message: errorMessage, color: "red" });
    },
  });
}
