import { useMutation, useQuery, UseQueryResult, useQueryClient } from '@tanstack/react-query';
import {
  createPage,
  deletePage,
  getPageById,
  getRecentChanges,
  updatePage,
} from '@/features/page/services/page-service';
import { IPage } from '@/features/page/types/page.types';
import { notifications } from '@mantine/notifications';

const RECENT_CHANGES_KEY = ['recentChanges'];

export function usePageQuery(pageId: string): UseQueryResult<IPage, Error> {
  return useQuery({
    queryKey: ['pages', pageId],
    queryFn: () => getPageById(pageId),
    enabled: !!pageId,
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
  });
}

export function useUpdatePageMutation() {
  return useMutation<IPage, Error, Partial<IPage>>({
    mutationFn: (data) => updatePage(data),
  });
}

export function useDeletePageMutation() {
  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId),
    onSuccess: () => {
      notifications.show({ message: 'Page deleted successfully' });
    },
  });
}
