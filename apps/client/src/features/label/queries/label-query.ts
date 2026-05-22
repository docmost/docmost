import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  addLabelsToPage,
  findPagesByLabel,
  getLabelInfo,
  getPageLabels,
  getWorkspaceLabels,
  removeLabelFromPage,
} from "@/features/label/services/label-service.ts";
import {
  IAddLabels,
  ILabel,
  IRemoveLabel,
} from "@/features/label/types/label.types.ts";
import { IPagination } from "@/lib/types.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const PAGE_LABELS_KEY = (pageId: string) => ["page-labels", pageId];
const WORKSPACE_LABELS_KEY = (query?: string) => ["workspace-labels", query ?? ""];

export function usePageLabelsQuery(pageId: string | undefined) {
  return useQuery({
    queryKey: PAGE_LABELS_KEY(pageId ?? ""),
    queryFn: () => getPageLabels({ pageId: pageId as string, limit: 100 }),
    enabled: !!pageId,
  });
}

export function useWorkspaceLabelsQuery(query: string, enabled: boolean) {
  return useQuery({
    queryKey: WORKSPACE_LABELS_KEY(query),
    queryFn: () => getWorkspaceLabels({ type: "page", query, limit: 50 }),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useAddLabelsMutation(pageId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<ILabel[], Error, IAddLabels>({
    mutationFn: (data) => addLabelsToPage(data),
    onSuccess: (added) => {
      queryClient.setQueryData<IPagination<ILabel>>(
        PAGE_LABELS_KEY(pageId ?? ""),
        (cache) => {
          if (!cache) return cache;
          const existing = new Set(cache.items.map((l) => l.id));
          const additions = added.filter((l) => !existing.has(l.id));
          if (additions.length === 0) return cache;
          return { ...cache, items: [...cache.items, ...additions] };
        },
      );

      queryClient.setQueriesData<IPagination<ILabel>>(
        { queryKey: ["workspace-labels"] },
        (cache) => {
          if (!cache) return cache;
          const existing = new Set(cache.items.map((l) => l.id));
          const additions = added.filter((l) => !existing.has(l.id));
          if (additions.length === 0) return cache;
          return {
            ...cache,
            items: [...cache.items, ...additions].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          };
        },
      );

      queryClient.invalidateQueries({ queryKey: ["label-pages"] });
      queryClient.invalidateQueries({ queryKey: ["label-info"] });
    },
    onError: (error: any) => {
      notifications.show({
        message: error?.response?.data?.message ?? t("Failed to add label"),
        color: "red",
      });
    },
  });
}

export function useRemoveLabelMutation(pageId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, IRemoveLabel>({
    mutationFn: (data) => removeLabelFromPage(data),
    onSuccess: (_data, variables) => {
      const cache = queryClient.getQueryData<IPagination<ILabel>>(
        PAGE_LABELS_KEY(pageId ?? ""),
      );
      if (cache) {
        queryClient.setQueryData<IPagination<ILabel>>(
          PAGE_LABELS_KEY(pageId ?? ""),
          {
            ...cache,
            items: cache.items.filter((l) => l.id !== variables.labelId),
          },
        );
      }
      queryClient.invalidateQueries({ queryKey: ["workspace-labels"] });
      queryClient.invalidateQueries({ queryKey: ["label-pages"] });
      queryClient.invalidateQueries({ queryKey: ["label-info"] });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to remove label"),
        color: "red",
      });
    },
  });
}

export function useLabelInfoQuery(name: string, spaceId?: string) {
  return useQuery({
    queryKey: ["label-info", name, spaceId ?? ""],
    queryFn: () => getLabelInfo({ name, type: "page", spaceId }),
    enabled: !!name,
    placeholderData: keepPreviousData,
  });
}

const LABEL_PAGES_LIMIT = 25;

export function useLabelPagesQuery(
  name: string,
  query: string,
  spaceId?: string,
) {
  return useInfiniteQuery({
    queryKey: ["label-pages", name, query, spaceId ?? ""],
    queryFn: ({ pageParam }) =>
      findPagesByLabel({
        name,
        query,
        spaceId,
        cursor: pageParam,
        limit: LABEL_PAGES_LIMIT,
      }),
    enabled: !!name,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage
        ? (lastPage.meta.nextCursor ?? undefined)
        : undefined,
    placeholderData: keepPreviousData,
  });
}
