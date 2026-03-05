import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useChatInfoQuery } from "../queries/ai-chat-query";
import { useChatStream } from "../hooks/use-chat-stream";
import ChatMessageList from "./chat-message-list";
import ChatEmptyState from "./chat-empty-state";
import ChatInput from "./chat-input";
import classes from "../styles/ai-chat.module.css";

export default function AiChatLayout() {
  const { chatId } = useParams<{ chatId: string }>();
  const chatInfoQuery = useChatInfoQuery(chatId);
  const {
    messages,
    streamingContent,
    streamingToolCalls,
    isStreaming,
    error,
    sendMessage,
    stopGeneration,
    initMessages,
  } = useChatStream(chatId);

  useEffect(() => {
    if (chatInfoQuery.data?.messages) {
      initMessages(chatInfoQuery.data.messages);
    }
  }, [chatInfoQuery.data, initMessages]);

  useEffect(() => {
    if (!chatId) {
      initMessages([]);
    }
  }, [chatId, initMessages]);

  const hasMessages = messages.length > 0 || isStreaming;

  if (!hasMessages) {
    return (
      <div className={classes.main}>
        <ChatEmptyState
          isStreaming={isStreaming}
          onSend={sendMessage}
          onStop={stopGeneration}
        />
      </div>
    );
  }

  return (
    <div className={classes.main}>
      <ChatMessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        streamingToolCalls={streamingToolCalls}
      />

      {error && (
        <div
          style={{
            padding: "0 var(--mantine-spacing-lg)",
            color: "var(--mantine-color-red-6)",
            fontSize: "var(--mantine-font-size-sm)",
          }}
        >
          {error}
        </div>
      )}

      <div className={classes.inputArea}>
        <ChatInput
          isStreaming={isStreaming}
          onSend={sendMessage}
          onStop={stopGeneration}
        />
      </div>
    </div>
  );
}
