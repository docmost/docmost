import {
  InfiniteData,
  QueryClient,
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { queryClient } from "@/main";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  listRelationRows,
  resolveRelationRows,
  searchRelationCandidates,
  searchRelationTargets,
  updateRelationLinks,
} from "@/ee/base/services/base-relation-service";
import type { IBaseRowsPage } from "@/ee/base/services/base-service";
import type { IBaseRow, RelationPreview } from "@/ee/base/types/base.types";

type PreviewsByRow = Record<string, Record<string, RelationPreview>>;

export function patchRelationPreviews(
  client: QueryClient,
  pageId: string,
  items: PreviewsByRow,
): void {
  const patchRow = (row: IBaseRow): IBaseRow => {
    const previews = items[row.id];
    return previews
      ? { ...row, relations: { ...row.relations, ...previews } }
      : row;
  };

  client.setQueriesData<InfiniteData<IBaseRowsPage>>(
    { queryKey: ["base-rows", pageId] },
    (old) =>
      old && {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map(patchRow),
        })),
      },
  );
  for (const rowId of Object.keys(items)) {
    client.setQueryData<IBaseRow>(["base-row", pageId, rowId], (old) =>
      old && patchRow(old),
    );
  }
}

type UpdateRelationLinksVariables = {
  rowId: string;
  propertyId: string;
  add?: string[];
  remove?: string[];
};

export function useUpdateRelationLinksMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<
    { preview: RelationPreview },
    Error,
    UpdateRelationLinksVariables
  >({
    // no request id: the live event can name rows this tab didn't patch, so it must not be dropped
    mutationFn: (variables) => updateRelationLinks({ ...variables, pageId }),
    onSuccess: ({ preview }, variables) => {
      patchRelationPreviews(queryClient, pageId, {
        [variables.rowId]: { [variables.propertyId]: preview },
      });
      queryClient.invalidateQueries({
        queryKey: ["base-relations", "list", pageId, variables.rowId, variables.propertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["base-relations", "candidates", pageId, variables.propertyId, variables.rowId],
      });
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update row")),
        color: "red",
      });
    },
  });
}

export function useRelationCandidatesInfiniteQuery(args: {
  pageId: string;
  propertyId: string;
  rowId?: string;
  query: string;
  enabled: boolean;
}) {
  const { pageId, propertyId, rowId, query, enabled } = args;
  return useInfiniteQuery({
    queryKey: ["base-relations", "candidates", pageId, propertyId, rowId ?? null, query],
    queryFn: ({ pageParam }) =>
      searchRelationCandidates({ pageId, propertyId, rowId, query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    enabled,
    staleTime: 15_000,
    // linked flags go stale on every link change, so reopening must refetch
    refetchOnMount: true,
    placeholderData: keepPreviousData,
  });
}

export function useRelationRowsInfiniteQuery(args: {
  pageId: string;
  rowId: string;
  propertyId: string;
  enabled: boolean;
}) {
  const { pageId, rowId, propertyId, enabled } = args;
  return useInfiniteQuery({
    queryKey: ["base-relations", "list", pageId, rowId, propertyId],
    queryFn: ({ pageParam }) =>
      listRelationRows({ pageId, rowId, propertyId, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled,
    // links changed elsewhere only patch previews, so a cached list is always revalidated
    staleTime: 0,
  });
}

export function useResolveRelationRows(args: {
  pageId: string;
  propertyId: string;
  rowIds: string[];
}) {
  const { pageId, propertyId, rowIds } = args;
  const sortedIds = [...rowIds].sort();
  return useQuery({
    queryKey: ["base-relations", "resolve", pageId, propertyId, sortedIds],
    queryFn: () => resolveRelationRows({ pageId, propertyId, rowIds: sortedIds }),
    enabled: sortedIds.length > 0,
    // known titles stay on screen while a changed selection resolves
    placeholderData: keepPreviousData,
  });
}

export function useRelationTargetsQuery(query: string, enabled = true) {
  return useQuery({
    queryKey: ["base-relations", "targets", query],
    queryFn: () => searchRelationTargets(query),
    enabled,
    placeholderData: keepPreviousData,
  });
}
