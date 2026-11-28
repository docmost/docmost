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
import { v7 as uuid7 } from "uuid";
import { queryClient } from "@/main";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  listRelationRows,
  resolveRelationRows,
  searchRelationTargets,
  suggestRelationRows,
  updateRelationLinks,
} from "@/ee/base/services/base-relation-service";
import { expandRows, type IBaseRowsPage } from "@/ee/base/services/base-service";
import {
  forgetRelationEditOutbound,
  markRelationEditOutbound,
} from "@/ee/base/hooks/use-base-socket";
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
  const invalidateLists = ({ rowId, propertyId }: UpdateRelationLinksVariables) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["base-relations", "list", pageId, rowId, propertyId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["base-relations", "suggestions", pageId, propertyId, rowId],
      }),
    ]);

  return useMutation<
    { preview: RelationPreview },
    Error,
    UpdateRelationLinksVariables
  >({
    // the live echo still refreshes other rows the change touched; this cell and its list are done here
    mutationFn: async (variables) => {
      const requestId = uuid7();
      markRelationEditOutbound(requestId, {
        rowId: variables.rowId,
        propertyId: variables.propertyId,
      });
      try {
        return await updateRelationLinks({ ...variables, pageId, requestId });
      } catch (error) {
        forgetRelationEditOutbound(requestId);
        throw error;
      }
    },
    onSuccess: ({ preview }, variables) => {
      patchRelationPreviews(queryClient, pageId, {
        [variables.rowId]: { [variables.propertyId]: preview },
      });
      // mutateAsync resolves once the open lists show the change
      return invalidateLists(variables);
    },
    onError: (error, variables) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update row")),
        color: "red",
      });
      // a request that failed on the way back may still have saved the change
      expandRows(pageId, [variables.rowId])
        .then((items) => {
          const relations = items[variables.rowId]?.relations;
          if (relations) {
            patchRelationPreviews(queryClient, pageId, { [variables.rowId]: relations });
          }
        })
        .catch(() => {});
      void invalidateLists(variables);
    },
  });
}

export function useRelationSuggestionsInfiniteQuery(args: {
  pageId: string;
  propertyId: string;
  rowId?: string;
  query: string;
  enabled: boolean;
}) {
  const { pageId, propertyId, rowId, query, enabled } = args;
  return useInfiniteQuery({
    queryKey: ["base-relations", "suggestions", pageId, propertyId, rowId ?? null, query],
    queryFn: ({ pageParam }) =>
      suggestRelationRows({ pageId, propertyId, rowId, query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    enabled,
    staleTime: 15_000,
    // a link change elsewhere moves rows in or out of this search, so reopening must refetch
    refetchOnMount: true,
    placeholderData: keepPreviousData,
  });
}

export function useRelationRowsInfiniteQuery(args: {
  pageId: string;
  rowId: string;
  propertyId: string;
  query?: string;
  enabled: boolean;
}) {
  const { pageId, rowId, propertyId, query = "", enabled } = args;
  return useInfiniteQuery({
    queryKey: ["base-relations", "list", pageId, rowId, propertyId, query],
    queryFn: ({ pageParam }) =>
      listRelationRows({
        pageId,
        rowId,
        propertyId,
        query: query || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled,
    // links changed while the picker was closed only patch previews, so reopening revalidates
    staleTime: 0,
    refetchOnMount: true,
    placeholderData: keepPreviousData,
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
