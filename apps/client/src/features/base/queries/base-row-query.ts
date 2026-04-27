import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  InfiniteData,
} from "@tanstack/react-query";
import {
  createRow,
  updateRow,
  deleteRow,
  deleteRows,
  listRows,
  reorderRow,
  countRows,
} from "@/features/base/services/base-service";
import {
  IBaseRow,
  CreateRowInput,
  UpdateRowInput,
  DeleteRowInput,
  DeleteRowsInput,
  ReorderRowInput,
  FilterNode,
  SearchSpec,
  ViewSortConfig,
  CountRowsResult,
} from "@/features/base/types/base.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";
import { IPagination } from "@/lib/types";
import { markRequestIdOutbound } from "@/features/base/hooks/use-base-socket";

type RowCacheContext = {
  snapshots: [readonly unknown[], InfiniteData<IPagination<IBaseRow>> | undefined][];
};

// An empty group filter (`{op: 'and', children: []}`) is the draft-layer's
// explicit "override baseline with no predicates" marker — see
// use-view-draft.ts. It carries no server-side meaning (buildWhere maps it
// to TRUE), so strip it at the query boundary to keep request payloads
// clean and cache keys stable when the user resets filters.
function normalizeFilter(filter: FilterNode | undefined): FilterNode | undefined {
  if (!filter) return undefined;
  if ('children' in filter && filter.children.length === 0) return undefined;
  return filter;
}

// Generate a fresh requestId and pre-register it as outbound so the
// incoming socket echo is suppressed by `useBaseSocket`.
function newRequestId(): string {
  const id =
    typeof crypto !== "undefined" &&
    typeof (crypto as any).randomUUID === "function"
      ? (crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  markRequestIdOutbound(id);
  return id;
}

export function useBaseRowsQuery(
  pageId: string | undefined,
  filter?: FilterNode,
  sorts?: ViewSortConfig[],
  search?: SearchSpec,
) {
  const activeFilter = normalizeFilter(filter);
  const activeSorts = sorts?.length ? sorts : undefined;
  const activeSearch = search?.query ? search : undefined;

  return useInfiniteQuery({
    queryKey: ["base-rows", pageId, activeFilter, activeSorts, activeSearch],
    queryFn: ({ pageParam }) =>
      listRows(pageId!, {
        cursor: pageParam,
        limit: 100,
        filter: activeFilter,
        sorts: activeSorts,
        search: activeSearch,
      }),
    enabled: !!pageId,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: IPagination<IBaseRow>) =>
      lastPage.meta?.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function flattenRows(
  data: InfiniteData<IPagination<IBaseRow>> | undefined,
): IBaseRow[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items);
}

export function useCreateRowMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseRow, Error, CreateRowInput>({
    mutationFn: (data) => createRow({ ...data, requestId: newRequestId() }),
    onSuccess: (newRow) => {
      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", newRow.pageId] },
        (old) => {
          if (!old) return old;
          const lastPageIndex = old.pages.length - 1;
          return {
            ...old,
            pages: old.pages.map((page, index) => {
              if (index === lastPageIndex) {
                return { ...page, items: [...page.items, newRow] };
              }
              return page;
            }),
          };
        },
      );
    },
    onError: () => {
      notifications.show({
        message: t("Failed to create row"),
        color: "red",
      });
    },
  });
}

export function useUpdateRowMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseRow, Error, UpdateRowInput, RowCacheContext>({
    mutationFn: (data) => updateRow({ ...data, requestId: newRequestId() }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["base-rows", variables.pageId],
      });

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IPagination<IBaseRow>>
      >({ queryKey: ["base-rows", variables.pageId] });

      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", variables.pageId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((row) =>
                row.id === variables.rowId
                  ? {
                      ...row,
                      cells: { ...row.cells, ...variables.cells },
                    }
                  : row,
              ),
            })),
          };
        },
      );

      return { snapshots };
    },
    onError: (_, variables, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      notifications.show({
        message: t("Failed to update row"),
        color: "red",
      });
    },
    onSuccess: (updatedRow) => {
      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", updatedRow.pageId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((row) =>
                row.id === updatedRow.id
                  ? { ...row, ...updatedRow, cells: { ...row.cells, ...updatedRow.cells } }
                  : row,
              ),
            })),
          };
        },
      );
    },
  });
}

export function useDeleteRowMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, DeleteRowInput, RowCacheContext>({
    mutationFn: (data) => deleteRow({ ...data, requestId: newRequestId() }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["base-rows", variables.pageId],
      });

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IPagination<IBaseRow>>
      >({ queryKey: ["base-rows", variables.pageId] });

      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", variables.pageId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((row) => row.id !== variables.rowId),
            })),
          };
        },
      );

      return { snapshots };
    },
    onError: (_, variables, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      notifications.show({
        message: t("Failed to delete row"),
        color: "red",
      });
    },
  });
}

export function useDeleteRowsMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, DeleteRowsInput, RowCacheContext>({
    mutationFn: (data) => deleteRows({ ...data, requestId: newRequestId() }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["base-rows", variables.pageId],
      });

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IPagination<IBaseRow>>
      >({ queryKey: ["base-rows", variables.pageId] });

      const removeSet = new Set(variables.rowIds);
      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", variables.pageId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((row) => !removeSet.has(row.id)),
            })),
          };
        },
      );

      return { snapshots };
    },
    onError: (_, __, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      notifications.show({
        message: t("Failed to delete rows"),
        color: "red",
      });
    },
  });
}

/*
 * Row count for the current view. Fires in parallel with `useBaseRowsQuery`
 * — doesn't block first paint. Keyed by filter + search so an independent
 * view with a different filter gets its own cached count; `exact` is part
 * of the key so a "show exact" toggle doesn't clobber the estimate cache.
 */
export function useBaseRowsCountQuery(
  pageId: string | undefined,
  filter?: FilterNode,
  search?: SearchSpec,
  exact = false,
) {
  const activeFilter = normalizeFilter(filter);
  const activeSearch = search?.query ? search : undefined;

  return useQuery<CountRowsResult>({
    queryKey: ["base-rows-count", pageId, activeFilter, activeSearch, exact],
    queryFn: () =>
      countRows({
        pageId: pageId!,
        filter: activeFilter,
        search: activeSearch,
        exact,
      }),
    enabled: !!pageId,
    staleTime: 30 * 1000,
  });
}

export function useReorderRowMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, ReorderRowInput, RowCacheContext>({
    mutationFn: (data) => reorderRow({ ...data, requestId: newRequestId() }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["base-rows", variables.pageId],
      });

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IPagination<IBaseRow>>
      >({ queryKey: ["base-rows", variables.pageId] });

      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", variables.pageId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((row) =>
                row.id === variables.rowId
                  ? { ...row, position: variables.position }
                  : row,
              ),
            })),
          };
        },
      );

      return { snapshots };
    },
    onError: (_, variables, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      notifications.show({
        message: t("Failed to reorder row"),
        color: "red",
      });
    },
  });
}
