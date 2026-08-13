import api from "@/lib/api-client";
import type { IPagination } from "@/lib/types";
import type {
  WorkspaceAnalyticsDailyStat,
  WorkspaceAnalyticsListParams,
  WorkspaceAnalyticsParams,
  WorkspaceAnalyticsTopPage,
  WorkspaceAnalyticsTotals,
} from "@/ee/page-view/types/page-view-analytics.types";

export async function getWorkspacePageViewTotals(
  params?: WorkspaceAnalyticsParams,
): Promise<WorkspaceAnalyticsTotals> {
  const req = await api.post("/page-views/workspace-stats", params);
  return req.data;
}

export async function getWorkspacePageViewDailyStats(
  params?: WorkspaceAnalyticsListParams,
): Promise<IPagination<WorkspaceAnalyticsDailyStat>> {
  const req = await api.post("/page-views/workspace-daily-stats", params);
  return req.data;
}

export async function getWorkspacePageViewTopPages(
  params?: WorkspaceAnalyticsListParams,
): Promise<IPagination<WorkspaceAnalyticsTopPage>> {
  const req = await api.post("/page-views/workspace-top-pages", params);
  return req.data;
}
