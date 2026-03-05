import api from "@/lib/api-client.ts";
import type {
  AiChat,
  AiChatMessage,
  AiChatStreamEvent,
  ChatAttachment,
} from "../types/ai-chat.types";
import { IPagination } from "@/lib/types.ts";

export async function createChat(): Promise<AiChat> {
  const req = await api.post<AiChat>("/ai-chat/create");
  return req.data;
}

export async function listChats(params?: {
  limit?: number;
  cursor?: string;
}): Promise<IPagination<AiChat>> {
  const req = await api.post("/ai-chat/list", params);
  return req.data;
}

export async function getChatInfo(
  chatId: string,
): Promise<{ chat: AiChat; messages: AiChatMessage[] }> {
  const req = await api.post("/ai-chat/info", { chatId });
  return req.data;
}

export async function deleteChat(chatId: string): Promise<void> {
  await api.post("/ai-chat/delete", { chatId });
}

export async function updateChatTitle(
  chatId: string,
  title: string,
): Promise<void> {
  await api.post("/ai-chat/update", { chatId, title });
}

export async function searchChats(query: string): Promise<AiChat[]> {
  const req = await api.post("/ai-chat/search", { query });
  return req.data;
}

export async function uploadChatFile(file: File): Promise<ChatAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  return await api.post("/ai-chat/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function sendChatMessage(
  params: {
    chatId?: string;
    content: string;
    mentionedPageIds?: string[];
    attachmentIds?: string[];
  },
  onEvent: (event: AiChatStreamEvent) => void,
  onError?: (error: string) => void,
  onComplete?: () => void,
): AbortController {
  const abortController = new AbortController();

  (async () => {
    try {
      const response = await fetch("/api/ai-chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: abortController.signal,
        credentials: "include",
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `HTTP error ${response.status}`;
        try {
          const parsed = JSON.parse(errorBody);
          errorMessage = parsed.message || errorMessage;
        } catch {
          // use default
        }
        onError?.(errorMessage);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        onError?.("Response body is not readable");
        return;
      }

      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                onComplete?.();
                return;
              }
              try {
                const parsed = JSON.parse(data) as AiChatStreamEvent;
                onEvent(parsed);
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      onComplete?.();
    } catch (error: any) {
      if (error.name !== "AbortError") {
        onError?.(error.message);
      }
    }
  })();

  return abortController;
}
