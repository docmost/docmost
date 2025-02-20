import api from "@/lib/api-client";
import {
  IPageSearch,
  IPageSearchParams,
  ISuggestionResult,
  SearchSuggestionParams,
} from "@/features/search/types/search.types";

export async function searchSharedPage(
  params: IPageSearchParams,
): Promise<IPageSearch[]> {
  const req = await api.post<IPageSearch[]>("/share/search", params);
  return req.data;
}

export async function sharedSearchSuggestions(
  params: SearchSuggestionParams,
): Promise<ISuggestionResult> {
  const req = await api.post<ISuggestionResult>("/share/search/suggest", params);
  return req.data;
}
