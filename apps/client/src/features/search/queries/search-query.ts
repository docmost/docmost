import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  searchPage,
  searchShare,
  searchSuggestions,
} from "@/features/search/services/search-service";
import {
  IPageSearch,
  IPageSearchParams,
  ISuggestionResult,
  SearchSuggestionParams,
} from "@/features/search/types/search.types";

export function usePageSearchQuery(
  params: IPageSearchParams,
): UseQueryResult<IPageSearch[], Error> {
  return useQuery({
    queryKey: ["page-search", params],
    queryFn: () => searchPage(params),
    enabled: !!params.query,
  });
}

export function useSearchSuggestionsQuery(
  params: SearchSuggestionParams,
): UseQueryResult<ISuggestionResult, Error> {
  return useQuery({
    queryKey: ["search-suggestion", params.query],
    staleTime: 60 * 1000, // 1min
    queryFn: () => searchSuggestions(params),
    enabled: !!params.query,
  });
}

export function useShareSearchQuery(
  params: IPageSearchParams,
): UseQueryResult<IPageSearch[], Error> {
  return useQuery({
    queryKey: ["share-search", params],
    queryFn: () => searchShare(params),
    enabled: !!params.query,
  });
}
