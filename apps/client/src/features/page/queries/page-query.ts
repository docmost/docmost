import {
  InfiniteData,
  QueryKey,
  useInfiniteQuery,
  UseInfiniteQueryResult,
  useMutation,
  useQuery,
  UseQueryResult,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  createPage,
  deletePage,
  getPageById,
  getSidebarPages,
  updatePage,
  movePage,
  getPageBreadcrumbs,
  getRecentChanges,
  getCreatedByPages,
  getAllSidebarPages,
  getDeletedPages,
  restorePage,
} from "@/features/page/services/page-service";
import {
  IMovePage,
  IPage,
  IPageInput,
  SidebarPagesParams,
} from "@/features/page/types/page.types";
import { notifications } from "@mantine/notifications";
import { IPagination, QueryParams } from "@/lib/types.ts";
import { queryClient } from "@/main.tsx";
import { buildTree } from "@/features/page/tree/utils";
import { useEffect } from "react";
import { validate as isValidUuid } from "uuid";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { SpaceTreeNode } from "@/features/page/tree/types";
import { useQueryEmit } from "@/features/websocket/use-query-emit";

export function usePageQuery(
  pageInput: Partial<IPageInput>,
): UseQueryResult<IPage, Error> {
  const query = useQuery({
    queryKey: ["pages", pageInput.pageId],
    queryFn: () => getPageById(pageInput),
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

export function useCreatePageMutation() {
  const { t } = useTranslation();
  return useMutation<IPage, Error, Partial<IPageInput>>({
    mutationFn: (data) => createPage(data),
    onSuccess: (data) => {
      invalidateOnCreatePage(data);
    },
    onError: (error) => {
      notifications.show({ message: t("Failed to create page"), color: "red" });
    },
  });
}

export function updatePageData(data: IPage) {
  const pageBySlug = queryClient.getQueryData<IPage>(["pages", data.slugId]);
  const pageById = queryClient.getQueryData<IPage>(["pages", data.id]);

  if (pageBySlug) {
    queryClient.setQueryData(["pages", data.slugId], {
      ...pageBySlug,
      ...data,
    });
  }

  if (pageById) {
    queryClient.setQueryData(["pages", data.id], { ...pageById, ...data });
  }

  invalidateOnUpdatePage(
    data.spaceId,
    data.parentPageId,
    data.id,
    data.title,
    data.icon,
  );
}

export function useUpdateTitlePageMutation() {
  return useMutation<IPage, Error, Partial<IPageInput>>({
    mutationFn: (data) => updatePage(data),
  });
}

export function useUpdatePageMutation() {
  return useMutation<IPage, Error, Partial<IPageInput>>({
    mutationFn: (data) => updatePage(data),
    onSuccess: (data) => {
      updatePageData(data);
    },
  });
}

export function useRemovePageMutation() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId, false),
    onSuccess: (_, pageId) => {
      notifications.show({ message: t("Page moved to trash") });

      // Stamp deletedAt so a re-visit shows the trash banner, not stale state.
      const cached = queryClient.getQueryData<IPage>(["pages", pageId]);
      if (cached) {
        const stamped = { ...cached, deletedAt: new Date() };
        queryClient.setQueryData(["pages", cached.id], stamped);
        queryClient.setQueryData(["pages", cached.slugId], stamped);
      }

      invalidateOnDeletePage(pageId);
      queryClient.invalidateQueries({
        predicate: (item) =>
          ["trash-list"].includes(item.queryKey[0] as string),
      });
    },
    onError: (error) => {
      notifications.show({ message: t("Failed to delete page"), color: "red" });
    },
  });
}

export function useDeletePageMutation() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId, true),
    onSuccess: (data, pageId) => {
      notifications.show({ message: t("Page deleted successfully") });
      invalidateOnDeletePage(pageId);

      // Invalidate to refresh trash lists
      queryClient.invalidateQueries({
        predicate: (item) =>
          ["trash-list"].includes(item.queryKey[0] as string),
      });
    },
    onError: (error) => {
      const message =
        error["response"]?.data?.message || t("Failed to delete page");
      notifications.show({ message, color: "red" });
    },
  });
}

export function useMovePageMutation() {
  return useMutation<void, Error, IMovePage>({
    mutationFn: (data) => movePage(data),
  });
}

export function useRestorePageMutation() {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useAtom(treeDataAtom);
  const emit = useQueryEmit();

  return useMutation({
    mutationFn: (pageId: string) => restorePage(pageId),
    onSuccess: async (restoredPage) => {
      notifications.show({ message: t("Page restored successfully") });

      // Check if the page already exists in the tree (it shouldn't)
      if (!treeModel.find(treeData, restoredPage.id)) {
        // Create the tree node data with hasChildren from backend
        const nodeData: SpaceTreeNode = {
          id: restoredPage.id,
          slugId: restoredPage.slugId,
          name: restoredPage.title || "Untitled",
          icon: restoredPage.icon,
          position: restoredPage.position,
          spaceId: restoredPage.spaceId,
          parentPageId: restoredPage.parentPageId,
          hasChildren: restoredPage.hasChildren || false,
          children: [],
        };

        // Determine the parent and index
        const parentId = restoredPage.parentPageId || null;
        let index = 0;

        if (parentId) {
          const parentNode = treeModel.find(treeData, parentId);
          if (parentNode) {
            index = parentNode.children?.length || 0;
          }
        } else {
          // Root level page
          index = treeData.length;
        }

        // Add the node to the tree
        setTreeData(treeModel.insert(treeData, parentId, nodeData, index));

        // Emit websocket event to sync with other users
        setTimeout(() => {
          emit({
            operation: "addTreeNode",
            spaceId: restoredPage.spaceId,
            payload: {
              parentId,
              index,
              data: nodeData,
            },
          });
        }, 50);
      }

      addPageToSidebarCache(restoredPage);

      // Also invalidate deleted pages query to refresh the trash list
      await queryClient.invalidateQueries({
        queryKey: ["trash-list", restoredPage.spaceId],
      });

      // Merge — restore endpoint returns a skinny page;
      // Replace would strip space/permissions/content and break the editor.
      const merge = (cached: IPage | undefined) =>
        cached ? { ...cached, ...restoredPage } : cached;
      queryClient.setQueryData<IPage>(["pages", restoredPage.id], merge);
      queryClient.setQueryData<IPage>(["pages", restoredPage.slugId], merge);
    },
    onError: (error) => {
      notifications.show({ message: t("Failed to restore page"), color: "red" });
    },
  });
}

export function useGetSidebarPagesQuery(
  data: SidebarPagesParams | null,
): UseInfiniteQueryResult<InfiniteData<IPagination<IPage>, unknown>> {
  return useInfiniteQuery({
    queryKey: ["sidebar-pages", data],
    enabled: !!data?.pageId || !!data?.spaceId,
    queryFn: ({ pageParam }) => getSidebarPages({ ...data, cursor: pageParam, limit: 100 }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.nextCursor ?? undefined,
  });
}

export function useGetRootSidebarPagesQuery(data: SidebarPagesParams) {
  return useInfiniteQuery({
    queryKey: ["root-sidebar-pages", data.spaceId],
    queryFn: async ({ pageParam }) => {
      return getSidebarPages({ spaceId: data.spaceId, cursor: pageParam, limit: 100 });
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.nextCursor ?? undefined,
  });
}

export function usePageBreadcrumbsQuery(
  pageId: string,
): UseQueryResult<Partial<IPage[]>, Error> {
  return useQuery({
    queryKey: ["breadcrumbs", pageId],
    queryFn: () => getPageBreadcrumbs(pageId),
    enabled: !!pageId,
  });
}

export async function fetchAllAncestorChildren(params: SidebarPagesParams) {
  // not using a hook here, so we can call it inside a useEffect hook
  const response = await queryClient.fetchQuery({
    queryKey: ["sidebar-pages", params],
    queryFn: () => getAllSidebarPages(params),
    staleTime: 30 * 60 * 1000,
  });

  const allItems = response.pages.flatMap((page) => page.items);
  return buildTree(allItems);
}

export function useRecentChangesQuery(spaceId?: string) {
  return useInfiniteQuery({
    queryKey: ["recent-changes", spaceId],
    queryFn: ({ pageParam }) =>
      getRecentChanges({ spaceId, cursor: pageParam, limit: 15 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    refetchOnMount: true,
  });
}

export function useCreatedByQuery(params?: { userId?: string; spaceId?: string }) {
  const { userId, spaceId } = params ?? {};
  return useInfiniteQuery({
    queryKey: ["pages-created-by-user", { userId, spaceId }],
    queryFn: ({ pageParam }) => getCreatedByPages({ userId, spaceId, cursor: pageParam, limit: 15 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    refetchOnMount: true,
  });
}

export function useDeletedPagesQuery(
  spaceId: string,
  params?: QueryParams,
): UseQueryResult<IPagination<IPage>, Error> {
  return useQuery({
    queryKey: ["trash-list", spaceId, params],
    queryFn: () => getDeletedPages(spaceId, params),
    enabled: !!spaceId,
    placeholderData: keepPreviousData,
    refetchOnMount: true,
    staleTime: 0,
  });
}

function isSidebarChildrenQuery(queryKey: QueryKey, pageId: string): boolean {
  const params = queryKey[1] as SidebarPagesParams | undefined;
  return queryKey[0] === "sidebar-pages" && params?.pageId === pageId;
}

function isRootSidebarQuery(queryKey: QueryKey, spaceId: string): boolean {
  return queryKey[0] === "root-sidebar-pages" && queryKey[1] === spaceId;
}

function getSidebarQueriesByParent(
  parentPageId: string | null,
  spaceId: string,
) {
  return queryClient.getQueriesData<InfiniteData<IPagination<Partial<IPage>>>>({
    predicate: (query) =>
      parentPageId === null
        ? isRootSidebarQuery(query.queryKey, spaceId)
        : isSidebarChildrenQuery(query.queryKey, parentPageId),
  });
}

function appendPageToSidebarData(
  old: InfiniteData<IPagination<Partial<IPage>>> | undefined,
  pageData: Partial<IPage>,
) {
  if (!old) return old;

  const exists = old.pages.some((page) =>
    page.items.some((item) => item.id === pageData.id),
  );
  if (exists) return old;

  return {
    ...old,
    pages: old.pages.map((page, index) =>
      index === old.pages.length - 1
        ? { ...page, items: [...page.items, pageData] }
        : page,
    ),
  };
}

function updatePageInSidebarData(
  old: InfiniteData<IPagination<IPage>> | undefined,
  pageId: string,
  data: Partial<IPage>,
) {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      items: page.items.map((sidebarPage: IPage) =>
        sidebarPage.id === pageId ? { ...sidebarPage, ...data } : sidebarPage,
      ),
    })),
  };
}

function removePageFromSidebarData(
  old: InfiniteData<IPagination<IPage>> | undefined,
  pageId: string,
) {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      items: page.items.filter(
        (sidebarPage: IPage) => sidebarPage.id !== pageId,
      ),
    })),
  };
}

function sidebarCacheHasItems(parentPageId: string | null, spaceId: string) {
  return getSidebarQueriesByParent(parentPageId, spaceId).some(([, data]) =>
    data?.pages.some((page) => page.items.length > 0),
  );
}

function updateSidebarPageHasChildren(pageId: string, hasChildren: boolean) {
  const allSideBarMatches = queryClient.getQueriesData<
    InfiniteData<IPagination<IPage>>
  >({
    predicate: (query) =>
      query.queryKey[0] === "root-sidebar-pages" ||
      query.queryKey[0] === "sidebar-pages",
  });

  allSideBarMatches.forEach(([key]) => {
    queryClient.setQueryData<InfiniteData<IPagination<IPage>>>(key, (old) =>
      updatePageInSidebarData(old, pageId, { hasChildren }),
    );
  });
}

export function addPageToSidebarCache(data: Partial<IPage>) {
  if (!data.id || !data.spaceId) return;

  const parentPageId = data.parentPageId ?? null;
  const newPage: Partial<IPage> = {
    creatorId: data.creatorId,
    hasChildren: data.hasChildren,
    icon: data.icon,
    id: data.id,
    parentPageId: data.parentPageId,
    position: data.position,
    slugId: data.slugId,
    spaceId: data.spaceId,
    title: data.title,
  };

  getSidebarQueriesByParent(parentPageId, data.spaceId).forEach(([key]) => {
    queryClient.setQueryData<InfiniteData<IPagination<Partial<IPage>>>>(
      key,
      (old) => appendPageToSidebarData(old, newPage),
    );
  });

  if (parentPageId !== null) {
    updateSidebarPageHasChildren(parentPageId, true);
  }
}

export function invalidateOnCreatePage(data: Partial<IPage>) {
  addPageToSidebarCache(data);

  //update recent changes
  queryClient.invalidateQueries({
    queryKey: ["recent-changes", data.spaceId],
  });
}

export function invalidateOnUpdatePage(
  spaceId: string,
  parentPageId: string | null,
  id: string,
  title: string,
  icon: string,
) {
  //update all sidebar pages
  getSidebarQueriesByParent(parentPageId, spaceId).forEach(([key]) => {
    queryClient.setQueryData<InfiniteData<IPagination<IPage>>>(key, (old) =>
      updatePageInSidebarData(old, id, { title, icon }),
    );
  });

  //update recent changes
  queryClient.invalidateQueries({
    queryKey: ["recent-changes", spaceId],
  });
}

export function updateCacheOnMovePage(
  spaceId: string,
  pageId: string,
  oldParentId: string | null,
  newParentId: string | null,
  pageData: Partial<IPage>,
) {
  // Remove page from old parent's cache
  getSidebarQueriesByParent(oldParentId, spaceId).forEach(([key]) => {
    queryClient.setQueryData<InfiniteData<IPagination<IPage>>>(key, (old) =>
      removePageFromSidebarData(old, pageId),
    );
  });

  // Update old parent's hasChildren flag if it has no more children
  if (oldParentId !== null) {
    if (!sidebarCacheHasItems(oldParentId, spaceId)) {
      updateSidebarPageHasChildren(oldParentId, false);
    }
  }

  // Add page to new parent's cache
  getSidebarQueriesByParent(newParentId, spaceId).forEach(([key]) => {
    queryClient.setQueryData<InfiniteData<IPagination<Partial<IPage>>>>(
      key,
      (old) => appendPageToSidebarData(old, pageData),
    );
  });

  // Update new parent's hasChildren flag
  if (newParentId !== null) {
    updateSidebarPageHasChildren(newParentId, true);
  }
}

export function invalidateOnDeletePage(pageId: string) {
  //update all sidebar pages
  const allSideBarMatches = queryClient.getQueriesData({
    predicate: (query) =>
      query.queryKey[0] === "root-sidebar-pages" ||
      query.queryKey[0] === "sidebar-pages",
  });

  allSideBarMatches.forEach(([key, d]) => {
    queryClient.setQueryData<InfiniteData<IPagination<IPage>>>(key, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.filter(
            (sidebarPage: IPage) => sidebarPage.id !== pageId,
          ),
        })),
      };
    });
  });

  //update recent changes
  queryClient.invalidateQueries({
    queryKey: ["recent-changes"],
  });
}
