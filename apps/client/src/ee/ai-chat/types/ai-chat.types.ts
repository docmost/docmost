export type AiChat = {
  id: string;
  workspaceId: string;
  creatorId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
};

export type AiChatMessage = {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls: AiChatToolCall[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AiChatStreamEvent =
  | { type: 'chat_created'; chatId: string }
  | { type: 'content'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; result: unknown }
  | { type: 'done'; messageId: string; usage?: Record<string, number> }
  | { type: 'error'; message: string };

export type PageMention = {
  id: string;
  title: string;
  slugId: string;
  spaceSlug?: string;
  icon?: string;
};

export type ChatAttachment = {
  id: string;
  fileName: string;
  fileExt: string;
  fileSize: number;
  mimeType: string;
};
