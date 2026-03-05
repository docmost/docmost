import { useState } from "react";
import { IconChevronRight, IconChevronDown, IconTool } from "@tabler/icons-react";
import type { AiChatToolCall } from "../types/ai-chat.types";
import classes from "../styles/chat-message.module.css";

const TOOL_LABELS: Record<string, string> = {
  list_spaces: "Listed spaces",
  search_pages: "Searched pages",
  get_page: "Read page",
  create_page: "Created page",
  update_page: "Updated page",
};

type Props = {
  toolCall: AiChatToolCall;
};

export default function ChatToolResult({ toolCall }: Props) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[toolCall.name] || toolCall.name;

  return (
    <div className={classes.toolCallCard}>
      <div
        className={classes.toolCallHeader}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <IconTool size={14} stroke={1.5} />
        <span className={classes.toolCallName}>{label}</span>
        {expanded ? (
          <IconChevronDown size={14} />
        ) : (
          <IconChevronRight size={14} />
        )}
      </div>
      {expanded && (
        <div className={classes.toolCallDetails}>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(
              { args: toolCall.args, result: toolCall.result },
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
