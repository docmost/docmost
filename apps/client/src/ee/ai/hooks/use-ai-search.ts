import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { askAi, IAiSearchResponse } from "@/ee/ai/services/ai-search-service.ts";
import { IPageSearchParams } from "@/features/search/types/search.types.ts";

// @ts-ignore
interface UseAiSearchResult extends UseMutationResult<IAiSearchResponse, Error, IPageSearchParams> {
  streamingAnswer: string;
  streamingSources: any[];
  clearStreaming: () => void;
}

export function useAiSearch(): UseAiSearchResult {
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [streamingSources, setStreamingSources] = useState<any[]>([]);

  const clearStreaming = useCallback(() => {
    setStreamingAnswer("");
    setStreamingSources([]);
  }, []);

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
    clearStreaming,
  };
}
