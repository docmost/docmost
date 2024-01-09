import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getPageHistoryById, getPageHistoryList } from '@/features/page-history/services/page-history-service';
import { IPageHistory } from '@/features/page-history/types/page.types';

export function usePageHistoryListQuery(pageId: string): UseQueryResult<IPageHistory[], Error> {
  return useQuery({
    queryKey: ['page-history-list', pageId],
    queryFn: () => getPageHistoryList(pageId),
    enabled: !!pageId,
  });
}

export function usePageHistoryQuery(historyId: string): UseQueryResult<IPageHistory, Error> {
  return useQuery({
    queryKey: ['page-history', historyId],
    queryFn: () => getPageHistoryById(historyId),
    enabled: !!historyId,
    staleTime: 10 * 60 * 1000,
  });
}
