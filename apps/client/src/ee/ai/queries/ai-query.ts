import {
  useMutation,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  generateAiContent,
  generateAiContentStream,
} from "@/ee/ai/services/ai-service.ts";
import {
  AiConfigResponse,
  AiContentResponse,
  AiGenerateDto,
  AiStreamChunk,
  AiStreamError,
} from "@/ee/ai/types/ai.types.ts";

export function useAiGenerateMutation(): UseMutationResult<
  AiContentResponse,
  Error,
  AiGenerateDto
> {
  return useMutation({
    mutationFn: (data: AiGenerateDto) => generateAiContent(data),
  });
}

interface StreamCallbacks {
  onChunk: (chunk: AiStreamChunk) => void;
  onError?: (error: AiStreamError) => void;
  onComplete?: () => void;
}

export function useAiGenerateStreamMutation(): UseMutationResult<
  AbortController,
  Error,
  AiGenerateDto & StreamCallbacks
> {
  return useMutation({
    mutationFn: ({ onChunk, onError, onComplete, ...data }) =>
      generateAiContentStream(data, onChunk, onError, onComplete),
  });
}
