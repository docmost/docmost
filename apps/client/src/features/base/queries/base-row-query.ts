import {
  useInfiniteQuery,
  useMutation,
  InfiniteData,
} from "@tanstack/react-query";
import {
  createRow,
  updateRow,
  deleteRow,
  listRows,
  reorderRow,
} from "@/features/base/services/base-service";
import {
  IBaseRow,
  CreateRowInput,
  UpdateRowInput,
  DeleteRowInput,
  ReorderRowInput,
  FilterNode,
  SearchSpec,
  ViewSortConfig,
} from "@/features/base/types/base.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";
import { IPagination } from "@/lib/types";
import { markRequestIdOutbound } from "@/features/base/hooks/use-base-socket";

type RowCacheContext = {
  snapshots: [readonly unknown[], InfiniteData<IPagination<IBaseRow>> | undefined][];
};

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
  baseId: string | undefined,
  filter?: FilterNode,
  sorts?: ViewSortConfig[],
  search?: SearchSpec,
) {
  const activeFilter = filter ?? undefined;
  const activeSorts = sorts?.length ? sorts : undefined;
  const activeSearch = search?.query ? search : undefined;

  return useInfiniteQuery({
    queryKey: ["base-rows", baseId, activeFilter, activeSorts, activeSearch],
    queryFn: ({ pageParam }) =>
      listRows(baseId!, {
        cursor: pageParam,
        limit: 100,
        filter: activeFilter,
        sorts: activeSorts,
        search: activeSearch,
      }),
    enabled: !!baseId,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: IPagination<IBaseRow>) =>
      lastPage.meta?.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
    // Cap cached pages so an invalidate after a type-conversion refetches
    // a bounded set instead of serially re-requesting every page the user
    // has ever scrolled through.
    maxPages: 5,
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
        { queryKey: ["base-rows", newRow.baseId] },
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
        queryKey: ["base-rows", variables.baseId],
      });

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IPagination<IBaseRow>>
      >({ queryKey: ["base-rows", variables.baseId] });

      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", variables.baseId] },
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
        { queryKey: ["base-rows", updatedRow.baseId] },
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
        queryKey: ["base-rows", variables.baseId],
      });

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IPagination<IBaseRow>>
      >({ queryKey: ["base-rows", variables.baseId] });

      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", variables.baseId] },
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

export function useReorderRowMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, ReorderRowInput, RowCacheContext>({
    mutationFn: (data) => reorderRow({ ...data, requestId: newRequestId() }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["base-rows", variables.baseId],
      });

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IPagination<IBaseRow>>
      >({ queryKey: ["base-rows", variables.baseId] });

      queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
        { queryKey: ["base-rows", variables.baseId] },
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
