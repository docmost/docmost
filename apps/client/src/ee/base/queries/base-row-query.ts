import { useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  InfiniteData,
  QueryKey,
} from "@tanstack/react-query";
import {
  createRow,
  updateRow,
  deleteRow,
  deleteRows,
  getRowInfo,
  listRows,
  reorderRow,
  IBaseRowsPage,
} from "@/ee/base/services/base-service";
import {
  IBase,
  IBaseRow,
  CreateRowInput,
  UpdateRowInput,
  DeleteRowInput,
  DeleteRowsInput,
  ReorderRowInput,
  FilterNode,
  ViewSortConfig,
  RowReferences,
  NO_VALUE_CHOICE_ID,
} from "@/ee/base/types/base.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";
import { useHydrateReferences } from "@/ee/base/reference/reference-store";
import { markRequestIdOutbound } from "@/ee/base/hooks/use-base-socket";
import { v7 as uuid7 } from "uuid";
import {
  BASE_ROW_MUTATION_KEY,
  beginRowUpdate,
  endRowUpdateChain,
  enqueueRowUpdate,
  getRowUpdateChain,
  mapCachedRow,
  reconcileRow,
  revertRowUpdate,
  ROW_UPDATE_MUTATION_KEY,
  RowUpdateContext,
} from "@/ee/base/queries/row-update-chain";

type RowCacheContext = {
  snapshots: [readonly unknown[], InfiniteData<IBaseRowsPage> | undefined][];
};

// An empty group filter is the draft-layer's "no predicates" marker (see use-view-draft.ts).
// Strip it at the query boundary to keep request payloads clean and cache keys stable.
export function normalizeFilter(filter: FilterNode | undefined): FilterNode | undefined {
  if (!filter) return undefined;
  if ('children' in filter && filter.children.length === 0) return undefined;
  return filter;
}

// Pre-register the requestId as outbound so the socket echo is suppressed by useBaseSocket.
export function newRequestId(): string {
  const id = uuid7();
  markRequestIdOutbound(id);
  return id;
}

const cancelledCalendarRefreshes = new Set<string>();

function cancelLoadedBaseRows(pageId: string) {
  if (
    !cancelledCalendarRefreshes.has(pageId) &&
    queryClient.isFetching({
      queryKey: ["base-rows", pageId, "calendar"],
      predicate: (query) => query.state.data !== undefined,
    }) > 0
  ) {
    cancelledCalendarRefreshes.add(pageId);
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      const mutatingRows = queryClient.isMutating({
        mutationKey: BASE_ROW_MUTATION_KEY,
        predicate: (mutation) =>
          (mutation.state.variables as { pageId?: string } | undefined)
            ?.pageId === pageId,
      });
      if (mutatingRows > 0) return;
      unsubscribe();
      cancelledCalendarRefreshes.delete(pageId);
      invalidateCalendarRows(pageId);
    });
  }
  return queryClient.cancelQueries({
    queryKey: ["base-rows", pageId],
    predicate: (query) => query.state.data !== undefined,
  });
}

export function baseRowsQueryKey(
  pageId: string | undefined,
  filter: FilterNode | undefined,
  sorts: ViewSortConfig[] | undefined,
) {
  return [
    "base-rows",
    pageId,
    normalizeFilter(filter),
    sorts?.length ? sorts : undefined,
  ] as const;
}


export function findRowInInfinite(
  data: InfiniteData<IBaseRowsPage> | undefined,
  rowId: string,
): IBaseRow | undefined {
  if (!data) return undefined;
  for (const page of data.pages) {
    const row = page.items.find((r) => r.id === rowId);
    if (row) return row;
  }
  return undefined;
}

export function useBaseRowsQuery(
  pageId: string | undefined,
  filter?: FilterNode,
  sorts?: ViewSortConfig[],
) {
  const activeFilter = normalizeFilter(filter);
  const activeSorts = sorts?.length ? sorts : undefined;

  const query = useInfiniteQuery({
    queryKey: baseRowsQueryKey(pageId, filter, sorts),
    queryFn: ({ pageParam }) =>
      listRows(pageId!, {
        cursor: pageParam,
        limit: 100,
        filter: activeFilter,
        sorts: activeSorts,
      }),
    enabled: !!pageId,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: IBaseRowsPage) =>
      lastPage.meta?.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
  });

  const refPages = useMemo(
    () =>
      (query.data?.pages ?? [])
        .map((p) => p.references)
        .filter(Boolean) as RowReferences[],
    [query.data],
  );
  useHydrateReferences(pageId, refPages);

  return query;
}

export function flattenRows(
  data: InfiniteData<IBaseRowsPage> | undefined,
): IBaseRow[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items);
}

export function useCreateRowMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseRow, Error, CreateRowInput>({
    mutationFn: (data) => createRow({ ...data, requestId: newRequestId() }),
    onSuccess: (newRow) => {
      queryClient.setQueriesData<InfiniteData<IBaseRowsPage>>(
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
      const base = queryClient.getQueryData<IBase>(["bases", newRow.pageId]);
      if ((base?.views ?? []).some((v) => v.type === "kanban")) {
        queryClient.invalidateQueries({
          queryKey: ["base-rows", newRow.pageId],
          refetchType: "none",
        });
      }
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create row")),
        color: "red",
      });
    },
  });
}

/** Single row by id — for deep links (?row=) pointing outside the loaded
 *  pages or the active view's filter. No retry: an error means the row is
 *  gone and the caller should close. */
export function useBaseRowQuery(
  pageId: string | undefined,
  rowId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery<IBaseRow, Error>({
    queryKey: ["base-row", pageId, rowId],
    queryFn: () => getRowInfo(rowId!, pageId!),
    enabled: !!pageId && !!rowId && (options?.enabled ?? true),
    retry: false,
  });
}

export function useUpdateRowMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseRow, Error, UpdateRowInput, RowUpdateContext>({
    mutationKey: ROW_UPDATE_MUTATION_KEY,
    mutationFn: (data) =>
      enqueueRowUpdate(data.rowId, () =>
        updateRow({ ...data, requestId: newRequestId() }),
      ),
    onMutate: async (variables) => {
      const { seq, supersedes } = beginRowUpdate(variables.rowId);

      await cancelLoadedBaseRows(variables.pageId);

      const previousRows = queryClient
        .getQueriesData<InfiniteData<IBaseRowsPage>>({
          queryKey: ["base-rows", variables.pageId],
        })
        .flatMap(([key, data]): [QueryKey, IBaseRow][] => {
          const row = findRowInInfinite(data, variables.rowId);
          return row ? [[key, row]] : [];
        });

      queryClient.setQueriesData<InfiniteData<IBaseRowsPage>>(
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
                      ...(variables.position !== undefined && {
                        position: variables.position,
                      }),
                    }
                  : row,
              ),
            })),
          };
        },
      );

      queryClient.setQueryData<IBaseRow>(
        ["base-row", variables.pageId, variables.rowId],
        (old) =>
          old
            ? { ...old, cells: { ...old.cells, ...variables.cells } }
            : old,
      );

      return { previousRows, seq, supersedes };
    },
    onError: (error, variables, context) => {
      const chain = getRowUpdateChain(variables.rowId);
      const isLatest = !chain || chain.seq === context?.seq;
      if (isLatest) {
        for (const [key, previous] of context?.previousRows ?? []) {
          queryClient.setQueryData<InfiniteData<IBaseRowsPage>>(key, (old) =>
            mapCachedRow(old, variables.rowId, (row) =>
              revertRowUpdate(row, previous, variables),
            ),
          );
        }
      }
      if (chain && (!isLatest || context?.supersedes)) {
        chain.reconcile = true;
      }
      if (!chain?.reconcile) {
        queryClient.invalidateQueries({
          queryKey: ["base-row", variables.pageId, variables.rowId],
        });
        invalidateCalendarRows(variables.pageId);
      }
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update row")),
        color: "red",
      });
    },
    onSuccess: (updatedRow, variables, context) => {
      const base = queryClient.getQueryData<IBase>(["bases", variables.pageId]);
      const kanbanGroupByIds = new Set(
        (base?.views ?? [])
          .filter((v) => v.type === "kanban")
          .map((v) => v.config?.groupByPropertyId)
          .filter(Boolean) as string[],
      );
      const changedPropertyIds = Object.keys(variables.cells ?? {});

      const chain = getRowUpdateChain(variables.rowId);
      if (chain) {
        if (changedPropertyIds.some((id) => kanbanGroupByIds.has(id))) {
          chain.regrouped = true;
        }
        if (isCalendarRelevantChange(base, changedPropertyIds)) {
          chain.calendarTouched = true;
        }
      }
      if (chain && chain.seq !== context?.seq) return;

      queryClient.setQueriesData<InfiniteData<IBaseRowsPage>>(
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
      queryClient.setQueryData<IBaseRow>(
        ["base-row", updatedRow.pageId, updatedRow.id],
        (old) =>
          old
            ? { ...old, ...updatedRow, cells: { ...old.cells, ...updatedRow.cells } }
            : old,
      );
    },
    onSettled: (_data, _error, variables, context) => {
      const chain = getRowUpdateChain(variables.rowId);
      if (!chain || chain.seq !== context?.seq) return;
      endRowUpdateChain(variables.rowId);
      if (chain.reconcile) reconcileRow(variables.pageId, variables.rowId);
      if (chain.regrouped) invalidateBaseRows(variables.pageId);
      else if (chain.calendarTouched) {
        invalidateCalendarRows(variables.pageId, "none");
      }
    },
  });
}

export function useDeleteRowMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, DeleteRowInput, RowCacheContext>({
    mutationKey: BASE_ROW_MUTATION_KEY,
    mutationFn: (data) => deleteRow({ ...data, requestId: newRequestId() }),
    onMutate: async (variables) => {
      await cancelLoadedBaseRows(variables.pageId);

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IBaseRowsPage>
      >({ queryKey: ["base-rows", variables.pageId] });

      queryClient.setQueriesData<InfiniteData<IBaseRowsPage>>(
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
    onError: (error, variables, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to delete row")),
        color: "red",
      });
    },
  });
}

export function useDeleteRowsMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, DeleteRowsInput, RowCacheContext>({
    mutationKey: BASE_ROW_MUTATION_KEY,
    mutationFn: (data) => deleteRows({ ...data, requestId: newRequestId() }),
    onMutate: async (variables) => {
      await cancelLoadedBaseRows(variables.pageId);

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IBaseRowsPage>
      >({ queryKey: ["base-rows", variables.pageId] });

      const removeSet = new Set(variables.rowIds);
      queryClient.setQueriesData<InfiniteData<IBaseRowsPage>>(
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
    onError: (error, __, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to delete rows")),
        color: "red",
      });
    },
  });
}




export function useReorderRowMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, ReorderRowInput, RowCacheContext>({
    mutationKey: BASE_ROW_MUTATION_KEY,
    mutationFn: (data) => reorderRow({ ...data, requestId: newRequestId() }),
    onMutate: async (variables) => {
      await cancelLoadedBaseRows(variables.pageId);

      const snapshots = queryClient.getQueriesData<
        InfiniteData<IBaseRowsPage>
      >({ queryKey: ["base-rows", variables.pageId] });

      queryClient.setQueriesData<InfiniteData<IBaseRowsPage>>(
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
    onError: (error, variables, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to reorder row")),
        color: "red",
      });
    },
  });
}

type KanbanMoveCardInput = {
  pageId: string;
  rowId: string;
  sourceColumnFilter: FilterNode | undefined;
  destColumnFilter: FilterNode | undefined;
  columnChanged: boolean;
  groupByPropertyId: string;
  destChoiceValue: string | null;
  position: string;
};

type KanbanMoveCardContext = {
  snapshots: [readonly unknown[], unknown][];
};

export function useKanbanMoveCardMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseRow, Error, KanbanMoveCardInput, KanbanMoveCardContext>({
    mutationKey: BASE_ROW_MUTATION_KEY,
    mutationFn: ({ pageId, rowId, columnChanged, groupByPropertyId, destChoiceValue, position }) =>
      updateRow({
        pageId,
        rowId,
        cells: columnChanged ? { [groupByPropertyId]: destChoiceValue } : {},
        position,
        requestId: newRequestId(),
      }),
    onMutate: async (variables) => {
      const { pageId, rowId, sourceColumnFilter, destColumnFilter, columnChanged, groupByPropertyId, destChoiceValue, position } = variables;

      await cancelLoadedBaseRows(pageId);

      const sourceKey = baseRowsQueryKey(pageId, sourceColumnFilter, undefined);
      const destKey = baseRowsQueryKey(pageId, destColumnFilter, undefined);

      const sourceSnapshot = queryClient.getQueryData<InfiniteData<IBaseRowsPage>>(sourceKey);
      const destSnapshot = queryClient.getQueryData<InfiniteData<IBaseRowsPage>>(destKey);
      const snapshots: KanbanMoveCardContext["snapshots"] = [
        [sourceKey, sourceSnapshot],
        [destKey, destSnapshot],
      ];

      if (columnChanged) {
        queryClient.setQueryData<InfiniteData<IBaseRowsPage>>(sourceKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((r) => r.id !== rowId),
            })),
          };
        });

        const movingRow = findRowInInfinite(sourceSnapshot, rowId);
        if (movingRow) {
          const moved: IBaseRow = {
            ...movingRow,
            cells: { ...movingRow.cells, [groupByPropertyId]: destChoiceValue },
            position,
          };
          queryClient.setQueryData<InfiniteData<IBaseRowsPage>>(destKey, (old) => {
            if (!old) return old;
            const lastPageIndex = old.pages.length - 1;
            return {
              ...old,
              pages: old.pages.map((page, index) =>
                index === lastPageIndex
                  ? { ...page, items: [...page.items, moved] }
                  : page,
              ),
            };
          });
        }

      } else {
        queryClient.setQueryData<InfiniteData<IBaseRowsPage>>(destKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((r) =>
                r.id === rowId ? { ...r, position } : r,
              ),
            })),
          };
        });
      }

      return { snapshots };
    },
    onError: (error, __, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to move card")),
        color: "red",
      });
    },
  });
}

type KanbanCreateCardInput = {
  pageId: string;
  destColumnFilter: FilterNode | undefined;
  groupByPropertyId: string;
  columnKey: string;
  position?: string;
};

export function useKanbanCreateCardMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseRow, Error, KanbanCreateCardInput>({
    mutationFn: ({ pageId, groupByPropertyId, columnKey, position }) =>
      createRow({
        pageId,
        cells: columnKey === NO_VALUE_CHOICE_ID ? {} : { [groupByPropertyId]: columnKey },
        position,
        requestId: newRequestId(),
      }),
    onSuccess: (newRow, variables) => {
      const { pageId, destColumnFilter } = variables;
      const destKey = baseRowsQueryKey(pageId, destColumnFilter, undefined);
      queryClient.setQueryData<InfiniteData<IBaseRowsPage>>(destKey, (old) => {
        if (!old) return old;
        const lastPageIndex = old.pages.length - 1;
        return {
          ...old,
          pages: old.pages.map((page, index) =>
            index === lastPageIndex
              ? { ...page, items: [...page.items, newRow] }
              : page,
          ),
        };
      });
      queryClient.setQueryData<IBaseRow>(
        ["base-row", newRow.pageId, newRow.id],
        newRow,
      );
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to add card")),
        color: "red",
      });
    },
  });
}

function removeInactiveCalendarRows(pageId: string) {
  queryClient.removeQueries({
    queryKey: ["base-rows", pageId, "calendar"],
    type: "inactive",
  });
}

export function invalidateBaseRows(pageId: string) {
  removeInactiveCalendarRows(pageId);
  queryClient.invalidateQueries({ queryKey: ["base-rows", pageId] });
}

export function invalidateCalendarRows(
  pageId: string,
  refetchType: "active" | "none" = "active",
) {
  removeInactiveCalendarRows(pageId);
  queryClient.invalidateQueries({
    queryKey: ["base-rows", pageId, "calendar"],
    refetchType,
  });
}

export function isCalendarRelevantChange(
  base: IBase | undefined,
  changedPropertyIds: string[],
): boolean {
  if (!base) return false;
  const relevantIds = new Set<string>();
  const addFilterPropertyIds = (node: FilterNode | undefined) => {
    if (!node) return;
    if ("children" in node) node.children.forEach(addFilterPropertyIds);
    else relevantIds.add(node.propertyId);
  };
  for (const view of base.views) {
    if (view.type !== "calendar") continue;
    const datePropertyId = view.config?.calendar?.datePropertyId;
    if (!datePropertyId) continue;
    const dateProperty = base.properties.find((p) => p.id === datePropertyId);
    if (dateProperty?.type === "lastEditedAt") return true;
    relevantIds.add(datePropertyId);
    addFilterPropertyIds(view.config?.filter);
  }
  const calendarQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ["base-rows", base.id, "calendar"] });
  for (const query of calendarQueries) {
    addFilterPropertyIds(query.queryKey[6] as FilterNode | undefined);
  }
  return changedPropertyIds.some((id) => relevantIds.has(id));
}
