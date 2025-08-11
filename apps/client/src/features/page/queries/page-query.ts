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
import { SimpleTree } from "react-arborist";
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
      updatePage(data);

      invalidateOnUpdatePage(
        data.spaceId,
        data.parentPageId,
        data.id,
        data.title,
        data.icon,
      );
    },
  });
}

export function useRemovePageMutation() {
  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId, false),
    onSuccess: (_, pageId) => {
      notifications.show({ message: "Page moved to trash" });
      invalidateOnDeletePage(pageId);
      queryClient.invalidateQueries({
        predicate: (item) =>
          ["trash-list"].includes(item.queryKey[0] as string),
      });
    },
    onError: (error) => {
      notifications.show({ message: "Failed to delete page", color: "red" });
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
      notifications.show({ message: t("Failed to delete page"), color: "red" });
    },
  });
}

export function useMovePageMutation() {
  return useMutation<void, Error, IMovePage>({
    mutationFn: (data) => movePage(data),
    onSuccess: () => {
      invalidateOnMovePage();
    },
  });
}

export function useRestorePageMutation() {
  const [treeData, setTreeData] = useAtom(treeDataAtom);
  const emit = useQueryEmit();

  return useMutation({
    mutationFn: (pageId: string) => restorePage(pageId),
    onSuccess: async (restoredPage) => {
      notifications.show({ message: "Page restored successfully" });

      // Add the restored page back to the tree
      const treeApi = new SimpleTree<SpaceTreeNode>(treeData);

      // Check if the page already exists in the tree (it shouldn't)
      if (!treeApi.find(restoredPage.id)) {
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
          const parentNode = treeApi.find(parentId);
          if (parentNode) {
            index = parentNode.children?.length || 0;
          }
        } else {
          // Root level page
          index = treeApi.data.length;
        }

        // Add the node to the tree
        treeApi.create({
          parentId,
          index,
          data: nodeData,
        });

        // Update the tree data
        setTreeData(treeApi.data);

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

      //  await queryClient.invalidateQueries({ queryKey: ["sidebar-pages", restoredPage.spaceId] });

      // Also invalidate deleted pages query to refresh the trash list
      await queryClient.invalidateQueries({
        queryKey: ["trash-list", restoredPage.spaceId],
      });
    },
    onError: (error) => {
      notifications.show({ message: "Failed to restore page", color: "red" });
    },
  });
}

export function useGetSidebarPagesQuery(
  data: SidebarPagesParams | null,
): UseInfiniteQueryResult<InfiniteData<IPagination<IPage>, unknown>> {
  return useInfiniteQuery({
    queryKey: ["sidebar-pages", data],
    queryFn: ({ pageParam }) => getSidebarPages({ ...data, page: pageParam }),
    initialPageParam: 1,
    getPreviousPageParam: (firstPage) =>
      firstPage.meta.hasPrevPage ? firstPage.meta.page - 1 : undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
  });
}

export function useGetRootSidebarPagesQuery(data: SidebarPagesParams) {
  return useInfiniteQuery({
    queryKey: ["root-sidebar-pages", data.spaceId],
    queryFn: async ({ pageParam }) => {
      return getSidebarPages({ spaceId: data.spaceId, page: pageParam });
    },
    initialPageParam: 1,
    getPreviousPageParam: (firstPage) =>
      firstPage.meta.hasPrevPage ? firstPage.meta.page - 1 : undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
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

export function useRecentChangesQuery(
  spaceId?: string,
): UseQueryResult<IPagination<IPage>, Error> {
  return useQuery({
    queryKey: ["recent-changes", spaceId],
    queryFn: () => getRecentChanges(spaceId),
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

export function invalidateOnCreatePage(data: Partial<IPage>) {
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

  let queryKey: QueryKey = null;
  if (data.parentPageId === null) {
    queryKey = ["root-sidebar-pages", data.spaceId];
  } else {
    queryKey = [
      "sidebar-pages",
      { pageId: data.parentPageId, spaceId: data.spaceId },
    ];
  }

  //update all sidebar pages
  queryClient.setQueryData<InfiniteData<IPagination<Partial<IPage>>>>(
    queryKey,
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page, index) => {
          if (index === old.pages.length - 1) {
            return {
              ...page,
              items: [...page.items, newPage],
            };
          }
          return page;
        }),
      };
    },
  );

  //update sidebar haschildren
  if (data.parentPageId !== null) {
    //update sub sidebar pages haschildern
    const subSideBarMatches = queryClient.getQueriesData({
      queryKey: ["sidebar-pages"],
      exact: false,
    });

    subSideBarMatches.forEach(([key, d]) => {
      queryClient.setQueryData<InfiniteData<IPagination<IPage>>>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((sidebarPage: IPage) =>
              sidebarPage.id === data.parentPageId
                ? { ...sidebarPage, hasChildren: true }
                : sidebarPage,
            ),
          })),
        };
      });
    });

    //update root sidebar pages haschildern
    const rootSideBarMatches = queryClient.getQueriesData({
      queryKey: ["root-sidebar-pages", data.spaceId],
      exact: false,
    });

    rootSideBarMatches.forEach(([key, d]) => {
      queryClient.setQueryData<InfiniteData<IPagination<IPage>>>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((sidebarPage: IPage) =>
              sidebarPage.id === data.parentPageId
                ? { ...sidebarPage, hasChildren: true }
                : sidebarPage,
            ),
          })),
        };
      });
    });
  }

  //update recent changes
  queryClient.invalidateQueries({
    queryKey: ["recent-changes", data.spaceId],
  });
}

export function invalidateOnUpdatePage(
  spaceId: string,
  parentPageId: string,
  id: string,
  title: string,
  icon: string,
) {
  let queryKey: QueryKey = null;
  if (parentPageId === null) {
    queryKey = ["root-sidebar-pages", spaceId];
  } else {
    queryKey = ["sidebar-pages", { pageId: parentPageId, spaceId: spaceId }];
  }
  //update all sidebar pages
  queryClient.setQueryData<InfiniteData<IPagination<IPage>>>(
    queryKey,
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((sidebarPage: IPage) =>
            sidebarPage.id === id
              ? { ...sidebarPage, title: title, icon: icon }
              : sidebarPage,
          ),
        })),
      };
    },
  );

  //update recent changes
  queryClient.invalidateQueries({
    queryKey: ["recent-changes", spaceId],
  });
}

export function invalidateOnMovePage() {
  //for move invalidate all sidebars for now (how to do???)
  //invalidate all root sidebar pages
  queryClient.invalidateQueries({
    queryKey: ["root-sidebar-pages"],
  });
  //invalidate all sub sidebar pages
  queryClient.invalidateQueries({
    queryKey: ["sidebar-pages"],
  });
  // ---
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
