import { useEffect, useRef } from "react";
import type { AiChatMessage, AiChatToolCall } from "../types/ai-chat.types";
import ChatMessage from "./chat-message";
import classes from "../styles/ai-chat.module.css";

type Props = {
  messages: AiChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  streamingToolCalls: AiChatToolCall[];
};

export default function ChatMessageList({
  messages,
  isStreaming,
  streamingContent,
  streamingToolCalls,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent, streamingToolCalls.length]);

  return (
    <div className={classes.messageList}>
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {isStreaming && (
        <ChatMessage
          message={{
            id: "streaming",
            chatId: "",
            role: "assistant",
            content: null,
            toolCalls: null,
            metadata: null,
            createdAt: new Date().toISOString(),
          }}
          isStreaming
          streamingContent={streamingContent}
          streamingToolCalls={streamingToolCalls}
        />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
