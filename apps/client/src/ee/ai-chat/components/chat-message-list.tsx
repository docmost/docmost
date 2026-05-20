import { useEffect, useRef, useCallback, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { IconArrowDown, IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { VisuallyHidden } from "@mantine/core";
import type { AiChatMessage, AiChatToolCall } from "../types/ai-chat.types";
import ChatMessage from "./chat-message";
import classes from "../styles/ai-chat.module.css";

function ChatMessageErrorFallback() {
  const { t } = useTranslation();
  return (
    <div className={classes.messageErrorFallback}>
      <IconAlertTriangle size={14} />
      <span>{t("Failed to render this message.")}</span>
    </div>
  );
}

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
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const isAutoScrollingRef = useRef(false);
  const prevScrollTopRef = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Dedicated status-region announcement for screen readers. Rather than
  // putting aria-live on the whole transcript (which re-fires for every
  // streamed token), announce "AI is thinking…" when streaming starts and
  // the full assistant reply once streaming completes — a single, clean read.
  const [statusAnnouncement, setStatusAnnouncement] = useState("");
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    const justStartedStreaming = isStreaming && !wasStreamingRef.current;
    const justFinishedStreaming = !isStreaming && wasStreamingRef.current;

    if (justStartedStreaming) {
      setStatusAnnouncement(t("AI is thinking..."));
    } else if (justFinishedStreaming) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.content) {
        // Strip markdown punctuation so screen readers don't read symbols
        // like # * _ ` ~ aloud. A plain-text version is fine — the styled
        // version stays in the DOM for visual users.
        const plainText = lastMessage.content
          .replace(/[#*_`~]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        setStatusAnnouncement(plainText);
      } else {
        setStatusAnnouncement("");
      }
    }

    wasStreamingRef.current = isStreaming;
  }, [isStreaming, messages, t]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) return;

    isAutoScrollingRef.current = true;
    const target = container.scrollHeight - container.clientHeight;
    container.scrollTo({ top: target, behavior });
    prevScrollTopRef.current = target;
    isAtBottomRef.current = true;
    setShowScrollButton(false);

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

    const distanceFromBottom =
      container.scrollHeight - currentScrollTop - container.clientHeight;
    const atBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX;

    if (scrolledUp) {
      isAtBottomRef.current = atBottom;
    } else if (atBottom) {
      isAtBottomRef.current = true;
    }

    setShowScrollButton(!atBottom);
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

  // Smooth scroll for new messages. Always force-scroll when the latest
  // message is from the user (they just sent it), even if they were reading
  // scrollback.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const lastIsUser = lastMessage?.role === "user";
    if (lastIsUser || isAtBottomRef.current) {
      scrollToBottom("smooth");
      return;
    }

    // No auto-scroll: recompute from actual layout so that chat switches to
    // content that doesn't overflow correctly hide the button even when no
    // scroll event fires.
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
    isAtBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
  }, [messages, scrollToBottom]);

  return (
    <div className={classes.messageListWrapper}>
      {/* Single status region for chat announcements. Kept outside the
          scrolling transcript so changes here trigger one polite read per
          state change instead of re-announcing every streamed token. */}
      <VisuallyHidden role="status" aria-live="polite">
        {statusAnnouncement}
      </VisuallyHidden>

      <div
        ref={containerRef}
        className={classes.messageList}
        aria-label={t("Chat transcript")}
      >
        {messages.map((msg) => (
          <ErrorBoundary
            key={msg.id}
            fallback={<ChatMessageErrorFallback />}
          >
            <ChatMessage message={msg} />
          </ErrorBoundary>
        ))}
        {isStreaming && (
          <ErrorBoundary
            resetKeys={[streamingContent, streamingToolCalls.length]}
            fallback={<ChatMessageErrorFallback />}
          >
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
          </ErrorBoundary>
        )}
        <div ref={bottomRef} />
      </div>
      {showScrollButton && (
        <button
          type="button"
          aria-label={t("Scroll to bottom")}
          className={classes.scrollToBottomButton}
          onClick={() => scrollToBottom("smooth")}
        >
          <IconArrowDown size={16} stroke={2} />
        </button>
      )}
    </div>
  );
}
