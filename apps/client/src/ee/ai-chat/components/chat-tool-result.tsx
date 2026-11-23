import { useState } from "react";
import { IconChevronRight, IconChevronDown } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { AiChatToolCall } from "../types/ai-chat.types";
import classes from "../styles/chat-message.module.css";

const TOOL_LABELS: Record<string, [action: string, completed: string]> = {
  list_spaces: ["List spaces", "Listed spaces"],
  search_pages: ["Search pages", "Searched pages"],
  get_page: ["Read page", "Read page"],
  get_page_schema: [
    "Read editor formatting guide",
    "Read editor formatting guide",
  ],
  create_page: ["Create page", "Created page"],
  update_page: ["Update page", "Updated page"],
  edit_page: ["Edit page", "Edited page"],
  read_page_sections: ["Read page sections", "Read page sections"],
  search_in_page: ["Search in page", "Searched in page"],
  semantic_search: ["Search pages", "Searched pages"],
  list_recent_pages: ["List recent pages", "Listed recent pages"],
  list_comments: ["Read comments", "Read comments"],
  get_space: ["Read space", "Read space"],
};

export function getToolLabel({ name, result }: AiChatToolCall, t: TFunction) {
  const action = TOOL_LABELS[name]?.[0] ?? name;
  if (result == null) return t(action);
  if (typeof result === "object" && "error" in result)
    return t("{{action}} (failed)", { action: t(action) });
  if (
    ["create_page", "update_page", "edit_page"].includes(name) &&
    (typeof result !== "object" ||
      !("id" in result) ||
      typeof result.id !== "string")
  )
    return t("{{action}} (unconfirmed)", { action: t(action) });
  return t(TOOL_LABELS[name]?.[1] ?? name);
}

type Props = {
  toolCall: AiChatToolCall;
};

export default function ChatToolResult({ toolCall }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  return (
    <div className={classes.toolStep}>
      <div
        className={classes.toolStepRow}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className={classes.toolStepBullet}>·</span>
        {expanded ? (
          <IconChevronDown size={12} />
        ) : (
          <IconChevronRight size={12} />
        )}
        <span>{getToolLabel(toolCall, t)}</span>
      </div>
      {expanded && (
        <div className={classes.toolStepDetails}>
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
