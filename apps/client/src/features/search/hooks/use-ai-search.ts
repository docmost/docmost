import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import { askAi, IAiSearchResponse } from "@/features/search/services/ai-search-service";
import { IPageSearchParams } from "@/features/search/types/search.types";

// @ts-ignore
interface UseAiSearchResult extends UseMutationResult<IAiSearchResponse, Error, IPageSearchParams> {
  streamingAnswer: string;
  streamingSources: any[];
}

export function useAiSearch(): UseAiSearchResult {
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [streamingSources, setStreamingSources] = useState<any[]>([]);

  const mutation = useMutation({
    mutationFn: async (params: IPageSearchParams & { contentType?: string }) => {
      setStreamingAnswer("");
      setStreamingSources([]);

      const { contentType, ...apiParams } = params;

      return await askAi(apiParams, (chunk) => {
        if (chunk.content) {
          setStreamingAnswer((prev) => prev + chunk.content);
        }
        if (chunk.sources) {
          setStreamingSources(chunk.sources);
        }
      });
    },
  });

  return {
    ...mutation,
    streamingAnswer,
    streamingSources,
  };
}
