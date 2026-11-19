import { useEffect, useMemo } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { DateKind } from "@docmost/base-formula/client";
import {
  listCalendarRows,
  ICalendarRowsPage,
} from "@/ee/base/services/base-service";
import {
  FilterNode,
  IBaseRow,
  RowReferences,
} from "@/ee/base/types/base.types";
import { normalizeFilter } from "@/ee/base/queries/base-row-query";
import { rowsDateKey, RowsDateKey } from "@/ee/base/queries/rows-date-key";
import { notifyRowsZone } from "@/ee/base/queries/rows-zone-notice";
import { useHydrateReferences } from "@/ee/base/reference/reference-store";
import { useViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";
import type { ViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";

export const CALENDAR_WINDOW_LIMIT = 1000;

export function calendarWindowQueryKey(
  pageId: string | undefined,
  propertyId: string | undefined,
  from: string,
  to: string,
  filter: FilterNode | undefined,
  viewer: ViewerDateContext,
): readonly [
  "base-rows",
  string | undefined,
  "calendar",
  string | undefined,
  string,
  string,
  FilterNode | undefined,
  RowsDateKey,
] {
  const active = normalizeFilter(filter);
  return [
    "base-rows",
    pageId,
    "calendar",
    propertyId,
    from,
    to,
    active,
    rowsDateKey(active, viewer) ?? { timeZone: viewer.timeZone },
  ] as const;
}

export function useCalendarWindowQuery(
  pageId: string | undefined,
  params: {
    propertyId: string | undefined;
    kind: DateKind | null;
    from: string;
    to: string;
    filter: FilterNode | undefined;
  },
) {
  const { propertyId, kind, from, to, filter } = params;
  const active = normalizeFilter(filter);
  const viewer = useViewerDateContext();
  const { t } = useTranslation();

  const query = useInfiniteQuery({
    queryKey: calendarWindowQueryKey(pageId, propertyId, from, to, filter, viewer),
    queryFn: ({ signal }) =>
      listCalendarRows(
        {
          pageId: pageId!,
          propertyId: propertyId!,
          from,
          to,
          filter: active,
          limit: CALENDAR_WINDOW_LIMIT,
          ...viewer,
        },
        signal,
      ),
    enabled: !!pageId && !!propertyId,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

  const rows = useMemo(() => {
    const byId = new Map<string, IBaseRow>();
    for (const page of query.data?.pages ?? []) {
      for (const row of page.items) {
        if (!byId.has(row.id)) byId.set(row.id, row);
      }
    }
    return [...byId.values()];
  }, [query.data]);

  const refPages = useMemo(
    () =>
      (query.data?.pages ?? [])
        .map((p) => p.references)
        .filter(Boolean) as RowReferences[],
    [query.data],
  );
  useHydrateReferences(pageId, refPages);

  const page: ICalendarRowsPage | undefined = query.data?.pages[0];
  const showingPlaceholder = query.isPlaceholderData;
  const serverZone = page?.meta?.timeZone;
  const zoneMatters =
    kind === "datetime" || rowsDateKey(active, viewer) !== undefined;
  useEffect(() => {
    if (!pageId || showingPlaceholder || !zoneMatters) return;
    notifyRowsZone(pageId, serverZone, viewer.timeZone, t, "calendar");
  }, [pageId, showingPlaceholder, zoneMatters, serverZone, viewer.timeZone, t]);

  return {
    rows,
    total: showingPlaceholder ? rows.length : (page?.meta?.total ?? rows.length),
    isTruncated: page?.meta?.truncated === true && !showingPlaceholder,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
