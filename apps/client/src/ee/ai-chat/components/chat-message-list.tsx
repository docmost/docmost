import { useEffect, useRef, useCallback } from "react";
import type { AiChatMessage, AiChatToolCall } from "../types/ai-chat.types";
import ChatMessage from "./chat-message";
import classes from "../styles/ai-chat.module.css";

type Props = {
  messages: AiChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  streamingToolCalls: AiChatToolCall[];
};

const BOTTOM_THRESHOLD_PX = 32;
const SCROLL_UP_THRESHOLD_PX = 5;
const SMOOTH_SCROLL_SETTLE_MS = 600;

export default function ChatMessageList({
  messages,
  isStreaming,
  streamingContent,
  streamingToolCalls,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const isAutoScrollingRef = useRef(false);
  const prevScrollTopRef = useRef(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) return;

    isAutoScrollingRef.current = true;
    const target = container.scrollHeight - container.clientHeight;
    container.scrollTo({ top: target, behavior });
    prevScrollTopRef.current = target;
    isAtBottomRef.current = true;

    if (behavior === "smooth") {
      setTimeout(() => {
        isAutoScrollingRef.current = false;
        if (containerRef.current) {
          prevScrollTopRef.current = containerRef.current.scrollTop;
        }
      }, SMOOTH_SCROLL_SETTLE_MS);
    } else {
      isAutoScrollingRef.current = false;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (isAutoScrollingRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const scrolledUp =
      currentScrollTop < prevScrollTopRef.current - SCROLL_UP_THRESHOLD_PX;
    prevScrollTopRef.current = currentScrollTop;

    if (scrolledUp) {
      const distanceFromBottom =
        container.scrollHeight - currentScrollTop - container.clientHeight;
      isAtBottomRef.current = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Instant scroll during streaming to keep up with rapid updates
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom("instant");
    }
  }, [streamingContent, streamingToolCalls.length, scrollToBottom]);

  // Smooth scroll for new messages (user or assistant finished)
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages.length, scrollToBottom]);

  return (
    <div ref={containerRef} className={classes.messageList}>
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
