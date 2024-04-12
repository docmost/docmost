import api from "@/lib/api-client";
import {
  IPageSearch,
  ISuggestionResult,
  SearchSuggestionParams,
} from "@/features/search/types/search.types";

export async function searchPage(query: string): Promise<IPageSearch[]> {
  const req = await api.post<IPageSearch[]>("/search", { query });
  return req.data;
}

export async function searchSuggestions(
  params: SearchSuggestionParams,
): Promise<ISuggestionResult> {
  const req = await api.post<ISuggestionResult>("/search/suggest", params);
  return req.data;
}
