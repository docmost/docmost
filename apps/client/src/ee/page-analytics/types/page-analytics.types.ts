import { QueryParams } from "@/lib/types";

export type WorkspaceAnalyticsParams = {
  startDate?: string;
  endDate?: string;
};

export type WorkspaceAnalyticsListParams = WorkspaceAnalyticsParams &
  QueryParams;

export type BasicStats = {
  totalViews: number;
  uniqueVisitors: number;
  authenticatedVisitors: number;
  sharedViews: number;
};

export type WorkspaceAnalyticsDailyStat = BasicStats & {
  viewDate: string;
};

export type WorkspaceAnalyticsTopPage = BasicStats & {
  pageId: string;
  pageTitle: string | null;
  pageSlugId: string | null;
  lastViewedAt: string | null;
};

export type WorkspaceAnalyticsTotals = {
  range: { startDate: string; endDate: string };
  totals: BasicStats;
};