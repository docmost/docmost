import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
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
} from "@/features/page/services/page-service";
import {
  IMovePage,
  IPage,
  IPageInput,
  SidebarPagesParams,
} from "@/features/page/types/page.types";
import { notifications } from "@mantine/notifications";
import { IPagination } from "@/lib/types.ts";
import { queryClient } from "@/main.tsx";
import { buildTree } from "@/features/page/tree/utils";
import { useEffect } from "react";
import { validate as isValidUuid } from "uuid";
import { useTranslation } from "react-i18next";

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
      invalidateOnCreatePage(data.spaceId, data.parentPageId);
    },
    onError: (error) => {
      notifications.show({ message: t("Failed to create page"), color: "red" });
    },
  });
}

export function useUpdatePageMutation() {
  const queryClient = useQueryClient();

  return useMutation<IPage, Error, Partial<IPageInput>>({
    mutationFn: (data) => updatePage(data),
    onSuccess: (data) => {
      const pageBySlug = queryClient.getQueryData<IPage>([
        "pages",
        data.slugId,
      ]);
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

      invalidateOnUpdatePage(data.spaceId, data.parentPageId, data.id, data.title, data.icon);
    },
  });
}

export function useDeletePageMutation() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId),
    onSuccess: (data, pageId) => {
      notifications.show({ message: t("Page deleted successfully") });
      invalidateOnDeletePage(pageId);
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

export function useGetSidebarPagesQuery(
  data: SidebarPagesParams,
): UseQueryResult<IPagination<IPage>, Error> {
  return useQuery({
    queryKey: ["sidebar-pages", data],
    queryFn: () => getSidebarPages(data),
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

export async function fetchAncestorChildren(params: SidebarPagesParams) {
  // not using a hook here, so we can call it inside a useEffect hook
  const response = await queryClient.fetchQuery({
    queryKey: ["sidebar-pages", params],
    queryFn: () => getSidebarPages(params),
    staleTime: 30 * 60 * 1000,
  });
  return buildTree(response.items);
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

export function invalidateOnCreatePage(spaceId: string, parentPageId: string) {
  //for create and move invalidate sidebar pages for now (how to do with pagination???)
  if(parentPageId===null){
    //invalidate root sidebar pages
    queryClient.invalidateQueries({
      queryKey: ["root-sidebar-pages", spaceId],
    });
  }else{
    //force refatch sub sidebar pages 
    queryClient.refetchQueries({
      queryKey: ['sidebar-pages', {pageId: parentPageId, spaceId: spaceId}],
    });
    //update sub sidebar pages haschildern
    const subSideBarMatches = queryClient.getQueriesData({
      queryKey: ['sidebar-pages'],
      exact: false,
    });
    
    subSideBarMatches.forEach(([key, d]) => {
      queryClient.setQueryData<IPagination<IPage>>(key, (old) => {
        return {
          ...old,
          items: old.items.map((sidebarPage) =>
            sidebarPage.id === parentPageId ? { ...sidebarPage, hasChildren: true } : sidebarPage
          ),
        };
      });
    });

    //update root sidebar pages haschildern
    const rootSideBarMatches = queryClient.getQueriesData({
      queryKey: ['root-sidebar-pages', spaceId],
      exact: false,
    });
    
    rootSideBarMatches.forEach(([key, d]) => {
      queryClient.setQueryData<InfiniteData<IPagination<IPage>>>(key, (old) => {
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((sidebarPage: IPage) =>
              sidebarPage.id === parentPageId ? { ...sidebarPage, hasChildren: true } : sidebarPage
            )
          })),
        };
      });
    });
  }
  //update recent changes
  queryClient.invalidateQueries({
    queryKey: ["recent-changes", spaceId],
  });
  // ---
}

export function invalidateOnUpdatePage(spaceId: string, parentPageId: string, id: string, title: string, icon: string) {
  if(parentPageId===null){
    //update root sidebar pages
    queryClient.setQueryData<InfiniteData<IPagination<IPage>>>(['root-sidebar-pages', spaceId], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((sidebarPage: IPage) =>
            sidebarPage.id === id ? { ...sidebarPage, title: title, icon: icon } : sidebarPage
          )
        })),
      };
    });
  }else{
    //update sub sidebar pages
    queryClient.setQueryData<IPagination<IPage>>(['sidebar-pages', {pageId: parentPageId, spaceId: spaceId}], (old) => {
      if (!old) return old;
      return {
        ...old,
        items: old.items.map((sidebarPage) =>
          sidebarPage.id === id ? { ...sidebarPage, title: title, icon: icon } : sidebarPage
        ),
      };
    });
  }
  //update recent changes
  queryClient.invalidateQueries({
    queryKey: ["recent-changes", spaceId],
  });
}

export function invalidateOnMovePage() {
  //for create and move invalidate all sidebars for now (how to do with pagination???)
  //invalidate all root sidebar pages
  queryClient.invalidateQueries({
    queryKey: ["root-sidebar-pages"],
  });
  //invalidate all sub sidebar pages
  queryClient.invalidateQueries({
    queryKey: ['sidebar-pages'],
  });
  // ---
}

export function invalidateOnDeletePage(pageId: string) {
  //update root sidebar pages
  const rootSideBarMatches = queryClient.getQueriesData({
    queryKey: ['root-sidebar-pages'],
    exact: false,
  });
  
  rootSideBarMatches.forEach(([key, d]) => {
    queryClient.setQueryData<InfiniteData<IPagination<IPage>>>(key, (old) => {
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.filter((sidebarPage: IPage) => sidebarPage.id !== pageId),
        })),
      };
    });
  });
  
  //update sub sidebar pages
  const subSideBarMatches = queryClient.getQueriesData({
    queryKey: ['sidebar-pages'],
    exact: false,
  });
  
  subSideBarMatches.forEach(([key, d]) => {
    console.log(key)
    console.log(d)
    queryClient.setQueryData<IPagination<IPage>>(key, (old) => {
      return {
        ...old,
        items: old.items.filter((sidebarPage: IPage) => sidebarPage.id !== pageId),
      };
    });
  });
  
  //update recent changes
  queryClient.invalidateQueries({
    queryKey: ["recent-changes"],
  });
}