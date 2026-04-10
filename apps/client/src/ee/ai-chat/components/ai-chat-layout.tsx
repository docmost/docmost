import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useChatInfoQuery } from "../queries/ai-chat-query";
import { useChatStream } from "../hooks/use-chat-stream";
import ChatMessageList from "./chat-message-list";
import ChatEmptyState from "./chat-empty-state";
import ChatInput from "./chat-input";
import type { HomeAiPromptInitialState } from "@/features/home/components/home-ai-prompt";
import classes from "../styles/ai-chat.module.css";

export default function AiChatLayout() {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const chatInfoQuery = useChatInfoQuery(chatId);
  const {
    messages,
    streamingContent,
    streamingToolCalls,
    isStreaming,
    error,
    sendMessage,
    stopGeneration,
    hydrateFromServer,
  } = useChatStream(chatId);

  const autoSentRef = useRef(false);

  useEffect(() => {
    if (chatInfoQuery.data?.messages) {
      hydrateFromServer(chatInfoQuery.data.messages);
    }
  }, [chatInfoQuery.data, hydrateFromServer]);

  useEffect(() => {
    if (autoSentRef.current || chatId) return;
    const state = location.state as HomeAiPromptInitialState | null;
    if (!state?.initialContent && !state?.initialAttachments?.length) return;

    autoSentRef.current = true;
    sendMessage(
      state.initialContent ?? "",
      state.initialMentions ?? [],
      state.initialAttachments ?? [],
    );
    navigate(location.pathname, { replace: true, state: null });
  }, [chatId, location, navigate, sendMessage]);

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className={classes.main}>
      {error && (
        <div
          style={{
            padding: "var(--mantine-spacing-sm) var(--mantine-spacing-lg)",
            color: "var(--mantine-color-red-6)",
            fontSize: "var(--mantine-font-size-sm)",
          }}
        >
          {error}
        </div>
      )}

      {hasMessages ? (
        <>
          <ChatMessageList
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            streamingToolCalls={streamingToolCalls}
          />
          <div className={classes.inputArea}>
            <ChatInput
              isStreaming={isStreaming}
              onSend={sendMessage}
              onStop={stopGeneration}
              chatId={chatId}
            />
          </div>
        </>
      ) : (
        <ChatEmptyState
          isStreaming={isStreaming}
          onSend={sendMessage}
          onStop={stopGeneration}
        />
      )}
    </div>
  );
}
