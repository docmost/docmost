import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { askAi, IAiSearchResponse } from "@/features/search/services/ai-search-service";
import { IPageSearchParams } from "@/features/search/types/search.types";

export function useAiSearch(): UseMutationResult<IAiSearchResponse, Error, IPageSearchParams> {
  return useMutation({
    mutationFn: async (params: IPageSearchParams) => {
      return await askAi(params);
    },
  });
}