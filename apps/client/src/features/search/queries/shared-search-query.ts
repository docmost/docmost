import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { searchSharedPage } from "@/features/search/services/shared-search-service";
import { IPageSearch, IPageSearchParams } from "@/features/search/types/search.types";

export function useSharedPageSearchQuery(
  params: IPageSearchParams,
): UseQueryResult<IPageSearch[], Error> {
  return useQuery({
    queryKey: ["page-search", params],
    queryFn: () => searchSharedPage(params),
    enabled: !!params.query,
  });
}
