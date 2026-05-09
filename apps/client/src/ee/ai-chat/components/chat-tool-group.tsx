import { useState } from "react";
import {
  IconChevronRight,
  IconChevronDown,
  IconLoader2,
} from "@tabler/icons-react";
import type { AiChatToolCall } from "../types/ai-chat.types";
import ChatToolResult, { TOOL_LABELS } from "./chat-tool-result";
import classes from "../styles/chat-message.module.css";

type Props = {
  toolCalls: AiChatToolCall[];
  isStreaming?: boolean;
};

export default function ChatToolGroup({ toolCalls, isStreaming }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  const activeCall =
    isStreaming && toolCalls.length > 0
      ? [...toolCalls].reverse().find((tc) => tc.result === undefined)
      : undefined;

  const activeLabel = activeCall
    ? TOOL_LABELS[activeCall.name] || activeCall.name
    : null;

  return (
    <div className={classes.toolGroup}>
      <div
        className={classes.toolGroupHeader}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
      >
        {activeLabel ? (
          <IconLoader2 size={12} className={classes.processingSpinner} />
        ) : expanded ? (
          <IconChevronDown size={12} />
        ) : (
          <IconChevronRight size={12} />
        )}
        <span className={classes.toolGroupLabel}>
          {activeLabel ? `${activeLabel}…` : `Steps ${toolCalls.length}`}
        </span>
      </div>
      {expanded && (
        <div className={classes.toolGroupSteps}>
          {toolCalls.map((tc) => (
            <ChatToolResult key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}
