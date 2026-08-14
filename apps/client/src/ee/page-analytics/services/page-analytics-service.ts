import api from "@/lib/api-client";
import type { IPagination } from "@/lib/types";
import type {
  WorkspaceAnalyticsDailyStat,
  WorkspaceAnalyticsListParams,
  WorkspaceAnalyticsParams,
  WorkspaceAnalyticsTopPage,
  WorkspaceAnalyticsTotals,
} from "@/ee/page-analytics/types/page-analytics.types";

export async function getWorkspacePageAnalyticsTotals(
  params?: WorkspaceAnalyticsParams,
): Promise<WorkspaceAnalyticsTotals> {
  const req = await api.post("/page-analytics/workspace-stats", params);
  return req.data;
}

export async function getWorkspacePageAnalyticsDailyStats(
  params?: WorkspaceAnalyticsListParams,
): Promise<IPagination<WorkspaceAnalyticsDailyStat>> {
  const req = await api.post("/page-analytics/workspace-daily-stats", params);
  return req.data;
}

export async function getWorkspacePageAnalyticsTopPages(
  params?: WorkspaceAnalyticsListParams,
): Promise<IPagination<WorkspaceAnalyticsTopPage>> {
  const req = await api.post("/page-analytics/workspace-top-pages", params);
  return req.data;
}

export async function getPageAnalyticsRetention(): Promise<{ retentionDays: number }> {
  const req = await api.post("/page-analytics/retention");
  return req.data;
}

export async function updatePageAnalyticsRetention(data: {
  pageAnalyticsRetentionDays: number;
}): Promise<{ retentionDays: number }> {

  const req = await api.post("/page-analytics/retention/update", data);
  return req.data;
}