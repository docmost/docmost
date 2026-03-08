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
} from "@/features/base/types/base.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";
import { IPagination } from "@/lib/types";

type RowCacheContext = {
  previous: InfiniteData<IPagination<IBaseRow>> | undefined;
};

export function useBaseRowsQuery(baseId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["base-rows", baseId],
    queryFn: ({ pageParam }) =>
      listRows(baseId!, { cursor: pageParam, limit: 100 }),
    enabled: !!baseId,
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
    mutationFn: (data) => createRow(data),
    onSuccess: (newRow) => {
      queryClient.setQueryData<InfiniteData<IPagination<IBaseRow>>>(
        ["base-rows", newRow.baseId],
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
    mutationFn: (data) => updateRow(data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["base-rows", variables.baseId],
      });

      const previous = queryClient.getQueryData<
        InfiniteData<IPagination<IBaseRow>>
      >(["base-rows", variables.baseId]);

      queryClient.setQueryData<InfiniteData<IPagination<IBaseRow>>>(
        ["base-rows", variables.baseId],
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

      return { previous };
    },
    onError: (_, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["base-rows", variables.baseId],
          context.previous,
        );
      }
      notifications.show({
        message: t("Failed to update row"),
        color: "red",
      });
    },
    onSuccess: (updatedRow) => {
      queryClient.setQueryData<InfiniteData<IPagination<IBaseRow>>>(
        ["base-rows", updatedRow.baseId],
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
    mutationFn: (data) => deleteRow(data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["base-rows", variables.baseId],
      });

      const previous = queryClient.getQueryData<
        InfiniteData<IPagination<IBaseRow>>
      >(["base-rows", variables.baseId]);

      queryClient.setQueryData<InfiniteData<IPagination<IBaseRow>>>(
        ["base-rows", variables.baseId],
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

      return { previous };
    },
    onError: (_, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["base-rows", variables.baseId],
          context.previous,
        );
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
    mutationFn: (data) => reorderRow(data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["base-rows", variables.baseId],
      });

      const previous = queryClient.getQueryData<
        InfiniteData<IPagination<IBaseRow>>
      >(["base-rows", variables.baseId]);

      queryClient.setQueryData<InfiniteData<IPagination<IBaseRow>>>(
        ["base-rows", variables.baseId],
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

      return { previous };
    },
    onError: (_, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["base-rows", variables.baseId],
          context.previous,
        );
      }
      notifications.show({
        message: t("Failed to reorder row"),
        color: "red",
      });
    },
  });
}
