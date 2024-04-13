import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  createPage,
  deletePage,
  getPageById,
  getPages,
  getRecentChanges,
  getSpacePageOrder,
  updatePage,
} from "@/features/page/services/page-service";
import { IPage, IWorkspacePageOrder } from "@/features/page/types/page.types";
import { notifications } from "@mantine/notifications";

const RECENT_CHANGES_KEY = ["recentChanges"];

export function usePageQuery(pageId: string): UseQueryResult<IPage, Error> {
  return useQuery({
    queryKey: ["pages", pageId],
    queryFn: () => getPageById(pageId),
    enabled: !!pageId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGetPagesQuery(
  spaceId: string,
): UseQueryResult<IPage[], Error> {
  return useQuery({
    queryKey: ["pages", spaceId],
    queryFn: () => getPages(spaceId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentChangesQuery(): UseQueryResult<IPage[], Error> {
  return useQuery({
    queryKey: RECENT_CHANGES_KEY,
    queryFn: () => getRecentChanges(),
    refetchOnMount: true,
  });
}

export function useCreatePageMutation() {
  return useMutation<IPage, Error, Partial<IPage>>({
    mutationFn: (data) => createPage(data),
    onSuccess: (data) => {},
  });
}

export function useUpdatePageMutation() {
  return useMutation<IPage, Error, Partial<IPage>>({
    mutationFn: (data) => updatePage(data),
    onSuccess: (data) => {},
  });
}

export function useDeletePageMutation() {
  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId),
    onSuccess: () => {
      notifications.show({ message: "Page deleted successfully" });
    },
  });
}

export default function useSpacePageOrder(
  spaceId: string,
): UseQueryResult<IWorkspacePageOrder> {
  return useQuery({
    queryKey: ["page-order", spaceId],
    queryFn: async () => {
      return await getSpacePageOrder(spaceId);
    },
  });
}
