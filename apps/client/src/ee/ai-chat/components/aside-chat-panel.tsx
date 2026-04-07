import { useState, useEffect, useCallback } from "react";
import { ActionIcon, Popover, Tooltip } from "@mantine/core";
import {
  IconPlus,
  IconHistory,
  IconArrowsMaximize,
  IconX,
  IconSparkles,
  IconFileText,
  IconLanguage,
  IconSearch,
  IconChecklist,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { useChatStream } from "../hooks/use-chat-stream";
import { useChatInfoQuery } from "../queries/ai-chat-query";
import ChatMessageList from "./chat-message-list";
import ChatInput from "./chat-input";
import AsideChatHistory from "./aside-chat-history";
import type { ChatAttachment, PageMention } from "../types/ai-chat.types";
import classes from "../styles/aside-chat-panel.module.css";
import inputClasses from "../styles/chat-input.module.css";

type QuickAction = {
  icon: React.ReactNode;
  label: string;
  prompt: string;
};

export default function AsideChatPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, setAsideState] = useAtom(asideStateAtom);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { pageSlug } = useParams();
  const slugId = extractPageSlugId(pageSlug);
  const { data: page } = usePageQuery({ pageId: slugId });

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
  } = useChatStream(chatId, {
    onChatCreated: (newChatId) => {
      setChatId(newChatId);
    },
  });

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

  const handleNewChat = useCallback(() => {
    setChatId(undefined);
  }, []);

  const handleSelectChat = useCallback((selectedChatId: string) => {
    setChatId(selectedChatId);
    setHistoryOpen(false);
  }, []);

  const handleExpand = useCallback(() => {
    if (chatId) {
      navigate(`/ai/chat/${chatId}`);
    } else {
      navigate("/ai");
    }
    setAsideState({ tab: "", isAsideOpen: false });
  }, [chatId, navigate, setAsideState]);

  const handleClose = useCallback(() => {
    setAsideState({ tab: "", isAsideOpen: false });
  }, [setAsideState]);

  const handleSend = useCallback(
    (content: string, mentions: PageMention[], attachments: ChatAttachment[]) => {
      if (!chatId && page && messages.length === 0) {
        const pageAlreadyMentioned = mentions.some((m) => m.id === page.id);
        if (!pageAlreadyMentioned) {
          mentions = [
            ...mentions,
            { id: page.id, title: page.title || "", slugId: page.slugId },
          ];
        }
      }
      sendMessage(content, mentions, attachments);
    },
    [chatId, page, messages.length, sendMessage],
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      handleSend(prompt, [], []);
    },
    [handleSend],
  );

  const hasMessages = messages.length > 0 || isStreaming;

  const quickActions: QuickAction[] = [
    { icon: <IconFileText size={16} />, label: t("Summarize this page"), prompt: "Summarize this page" },
    { icon: <IconLanguage size={16} />, label: t("Translate this page"), prompt: "Translate this page" },
    { icon: <IconSearch size={16} />, label: t("Analyze for insights"), prompt: "Analyze this page for insights" },
    { icon: <IconChecklist size={16} />, label: t("Create a task tracker"), prompt: "Create a task tracker from this page" },
  ];

  return (
    <div className={classes.panel}>
      <div className={classes.toolbar}>
        <Tooltip label={t("New chat")} openDelay={250}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleNewChat}>
            <IconPlus size={16} />
          </ActionIcon>
        </Tooltip>

        <Popover
          opened={historyOpen}
          onChange={setHistoryOpen}
          position="bottom-start"
          width={280}
          shadow="md"
        >
          <Popover.Target>
            <Tooltip label={t("Chat history")} openDelay={250}>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setHistoryOpen((o) => !o)}>
                <IconHistory size={16} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <AsideChatHistory activeChatId={chatId} onSelect={handleSelectChat} />
          </Popover.Dropdown>
        </Popover>

        <div className={classes.toolbarSpacer} />

        <Tooltip label={t("Open full page")} openDelay={250}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleExpand}>
            <IconArrowsMaximize size={16} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t("Close")} openDelay={250}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleClose}>
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </div>

      {hasMessages ? (
        <>
          <div className={classes.messages}>
            <ChatMessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              streamingToolCalls={streamingToolCalls}
            />
          </div>

          {error && (
            <div style={{ padding: "0 4px", color: "var(--mantine-color-red-6)", fontSize: "var(--mantine-font-size-xs)" }}>
              {error}
            </div>
          )}
        </>
      ) : (
        <div className={classes.emptyState}>
          <IconSparkles size={36} stroke={1.5} className={classes.emptyStateIcon} />
          <div className={classes.emptyStateTitle}>{t("How can I help you today?")}</div>
          <div className={classes.quickActions}>
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={classes.quickAction}
                onClick={() => handleQuickAction(action.prompt)}
              >
                <span className={classes.quickActionIcon}>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={classes.inputArea}>
        <div className={inputClasses.inputWrapper}>
          <ChatInput
            isStreaming={isStreaming}
            onSend={handleSend}
            onStop={stopGeneration}
            placeholder={t("Ask anything...")}
            autofocus={false}
          />
        </div>
      </div>
    </div>
  );
}
