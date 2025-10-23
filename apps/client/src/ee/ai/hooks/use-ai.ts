import { useState, useCallback, useRef } from "react";
import { useAiGenerateStreamMutation } from "@/ee/ai/queries/ai-query.ts";
import { AiGenerateDto } from "@/ee/ai/types/ai.types.ts";

export function useAiStream() {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mutation = useAiGenerateStreamMutation();

  const startStream = useCallback(
    async (data: AiGenerateDto) => {
      setContent("");
      setIsStreaming(true);

      try {
        const controller = await mutation.mutateAsync({
          ...data,
          onChunk: (chunk) => {
            setContent((prev) => prev + chunk.content);
          },
          onError: (error) => {
            console.error("AI stream error:", error);
            setIsStreaming(false);
          },
          onComplete: () => {
            setIsStreaming(false);
          },
        });

        abortControllerRef.current = controller;
      } catch (error) {
        console.error("Failed to start stream:", error);
        setIsStreaming(false);
      }
    },
    [mutation]
  );

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const resetContent = useCallback(() => {
    setContent("");
  }, []);

  return {
    content,
    isStreaming,
    startStream,
    stopStream,
    resetContent,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}