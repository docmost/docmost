import {
  useInfiniteQuery,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  IPage,
  IPageInput,
  SidebarPagesParams,
} from "@/features/page/types/page.types";
import { IPagination } from "@/lib/types.ts";
import { queryClient } from "@/main.tsx";
import { buildTree } from "@/features/page/tree/utils";
import { useEffect } from "react";
import { validate as isValidUuid } from "uuid";
import { getSharedPageBreadcrumbs, getSharedPageById, getSharedRecentChanges, getSharedSidebarPages } from "@/features/page/services/shared-page-service";

export function useSharedPageQuery(
  pageInput: Partial<IPageInput>,
): UseQueryResult<IPage, Error> {
  const query = useQuery({
    queryKey: ["pages", pageInput.pageId],
    queryFn: () => getSharedPageById(pageInput),
    enabled: !!pageInput.pageId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      if (isValidUuid(pageInput.pageId)) {
        queryClient.setQueryData(["pages", query.data.slugId], query.data);
      } else {
        queryClient.setQueryData(["pages", query.data.id], query.data);
      }
    }
  }, [query.data]);

  return query;
}

export function useGetSharedSidebarPagesQuery(
  data: SidebarPagesParams,
): UseQueryResult<IPagination<IPage>, Error> {
  return useQuery({
    queryKey: ["sidebar-pages", data.spaceId],
    queryFn: () => getSharedSidebarPages(data),
  });
}

export function useGetRootSharedSidebarPagesQuery(data: SidebarPagesParams) {
  return useInfiniteQuery({
    queryKey: ["root-sidebar-pages", data.spaceId],
    queryFn: async ({ pageParam }) => {
      return getSharedSidebarPages({ spaceId: data.spaceId, page: pageParam });
    },
    initialPageParam: 1,
    getPreviousPageParam: (firstPage) =>
      firstPage.meta.hasPrevPage ? firstPage.meta.page - 1 : undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
  });
}

export function useSharedPageBreadcrumbsQuery(
  pageId: string,
): UseQueryResult<Partial<IPage[]>, Error> {
  return useQuery({
    queryKey: ["breadcrumbs", pageId],
    queryFn: () => getSharedPageBreadcrumbs(pageId),
    enabled: !!pageId,
  });
}

export async function fetchSharedAncestorChildren(params: SidebarPagesParams) {
  // not using a hook here, so we can call it inside a useEffect hook
  const response = await queryClient.fetchQuery({
    queryKey: ["sidebar-pages", params],
    queryFn: () => getSharedSidebarPages(params),
    staleTime: 30 * 60 * 1000,
  });
  return buildTree(response.items);
}

export function useSharedRecentChangesQuery(
  spaceId?: string,
): UseQueryResult<IPagination<IPage>, Error> {
  return useQuery({
    queryKey: ["recent-changes", spaceId],
    queryFn: () => getSharedRecentChanges(spaceId),
    refetchOnMount: true,
  });
}
