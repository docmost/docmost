import api from "@/lib/api-client";
import {
  IPageSearch,
  IPageSearchParams,
  ISuggestionResult,
  SearchSuggestionParams,
} from "@/features/search/types/search.types";

export async function searchPage(
  params: IPageSearchParams,
): Promise<IPageSearch[]> {
  const req = await api.post<IPageSearch[]>("/search", params);
  return req.data;
}

export async function searchSuggestions(
  params: SearchSuggestionParams,
): Promise<ISuggestionResult> {
  const req = await api.post<ISuggestionResult>("/search/suggest", params);
  return req.data;
}

export async function searchShare(
  params: IPageSearchParams,
): Promise<IPageSearch[]> {
  const req = await api.post<IPageSearch[]>("/search/share-search", params);
  return req.data;
}
