import { useEffect, useMemo } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { listRows, IBaseRowsPage } from "@/ee/base/services/base-service";
import {
  FilterNode,
  IBaseRow,
  RowReferences,
} from "@/ee/base/types/base.types";
import { flattenRows, normalizeFilter } from "@/ee/base/queries/base-row-query";
import { useHydrateReferences } from "@/ee/base/reference/reference-store";
import { buildCalendarFilter } from "@/ee/base/services/calendar-window";

export const CALENDAR_ROW_CAP = 1000;
const CALENDAR_PAGE_SIZE = 100;
const CALENDAR_MAX_PAGES = CALENDAR_ROW_CAP / CALENDAR_PAGE_SIZE;

type CalendarRowsParams = {
  filter: FilterNode | undefined;
  datePropertyId: string | undefined;
  from: string;
  to: string;
};

export function useCalendarRowsQuery(
  pageId: string | undefined,
  { filter, datePropertyId, from, to }: CalendarRowsParams,
) {
  const activeFilter = normalizeFilter(filter);

  const query = useInfiniteQuery({
    queryKey: [
      "base-rows",
      pageId,
      "calendar",
      datePropertyId,
      from,
      to,
      activeFilter,
    ],
    queryFn: ({ pageParam, signal }) =>
      listRows(
        pageId!,
        {
          cursor: pageParam,
          limit: CALENDAR_PAGE_SIZE,
          filter: buildCalendarFilter(activeFilter, datePropertyId!, from, to),
          sorts: [{ propertyId: datePropertyId!, direction: "asc" }],
        },
        signal,
      ),
    enabled: !!pageId && !!datePropertyId,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: IBaseRowsPage) =>
      lastPage.meta?.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

  const rows = useMemo(() => {
    const byId = new Map<string, IBaseRow>();
    for (const row of flattenRows(query.data)) {
      if (!byId.has(row.id)) byId.set(row.id, row);
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

  const { hasNextPage, isFetching, isPlaceholderData, isError, fetchNextPage } =
    query;
  const belowCap =
    rows.length < CALENDAR_ROW_CAP &&
    (query.data?.pages.length ?? 0) < CALENDAR_MAX_PAGES;

  useEffect(() => {
    if (hasNextPage && belowCap && !isFetching && !isPlaceholderData && !isError) {
      fetchNextPage();
    }
  }, [hasNextPage, belowCap, isFetching, isPlaceholderData, isError, fetchNextPage]);

  return {
    rows,
    isLoading: query.isLoading,
    isPlaceholderData,
    isFetchingNextPage: query.isFetchingNextPage,
    isError,
    refetch: query.refetch,
    isCapped: !belowCap && !!hasNextPage,
  };
}
