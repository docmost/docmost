import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  searchPage,
  searchSuggestions,
} from "@/features/search/services/search-service";
import {
  IPageSearch,
  ISuggestionResult,
  SearchSuggestionParams,
} from "@/features/search/types/search.types";

export function usePageSearchQuery(
  query: string,
): UseQueryResult<IPageSearch[], Error> {
  return useQuery({
    queryKey: ["page-search", query],
    queryFn: () => searchPage(query),
    enabled: !!query,
  });
}

export function useSearchSuggestionsQuery(
  params: SearchSuggestionParams,
): UseQueryResult<ISuggestionResult, Error> {
  return useQuery({
    queryKey: ["search-suggestion", params],
    queryFn: () => searchSuggestions(params),
    enabled: !!params.query,
  });
}
