import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { searchPage } from '@/features/search/services/search-service';
import { IPageSearch } from '@/features/search/types/search.types';

export function usePageSearchQuery(query: string): UseQueryResult<IPageSearch[], Error> {
  return useQuery({
    queryKey: ['page-history', query],
    queryFn: () => searchPage(query),
    enabled: !!query,
  });
}
