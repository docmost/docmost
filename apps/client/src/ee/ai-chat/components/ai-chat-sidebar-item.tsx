import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ActionIcon, Menu, TextInput } from "@mantine/core";
import { IconDots, IconTrash, IconEdit } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AiChat } from "../types/ai-chat.types";
import classes from "../styles/chat-sidebar.module.css";

type Props = {
  chat: AiChat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onRename: (chatId: string, title: string) => void;
};

function formatChatDate(
  isoString: string | Date,
  locale: string | undefined,
): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const ts = date.getTime();
  const sameYear = date.getFullYear() === now.getFullYear();

  if (ts >= startOfToday) {
    return date.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (sameYear) {
    return date.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AiChatSidebarItem({
  chat,
  isActive,
  onDelete,
  onRename,
}: Props) {
  const { t, i18n } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const formattedDate = useMemo(
    () => formatChatDate(chat.updatedAt, i18n.language),
    [chat.updatedAt, i18n.language],
  );

  useEffect(() => {
    if (renaming) {
      // Wait for the input to be mounted before selecting.
      const id = window.setTimeout(() => inputRef.current?.select(), 0);
      return () => window.clearTimeout(id);
    }
  }, [renaming]);

  const startRename = useCallback(() => {
    setRenameValue(chat.title || "");
    setRenaming(true);
  }, [chat.title]);

  const submitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== chat.title) {
      onRename(chat.id, trimmed);
    }
    setRenaming(false);
  }, [renameValue, chat.id, chat.title, onRename]);

  if (renaming) {
    return (
      <div className={classes.chatItem} data-active={isActive || undefined}>
        <TextInput
          ref={inputRef}
          size="xs"
          variant="unstyled"
          placeholder={t("Chat name")}
          value={renameValue}
          onChange={(e) => setRenameValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitRename();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setRenaming(false);
            }
          }}
          onBlur={submitRename}
          classNames={{ input: classes.chatItemRenameInput }}
          style={{ flex: 1 }}
        />
      </div>
    );
  }

  return (
    <Link
      to={`/ai/chat/${chat.id}`}
      className={classes.chatItem}
      data-active={isActive || undefined}
    >
      <span className={classes.chatItemTitle}>
        {chat.title || t("Untitled chat")}
      </span>
      <span className={classes.chatItemDate}>{formattedDate}</span>
      <div className={classes.chatItemActions}>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              size="xs"
              color="gray"
              onClick={(e) => e.preventDefault()}
            >
              <IconDots size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconEdit size={14} />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startRename();
              }}
            >
              {t("Rename")}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconTrash size={14} />}
              color="red"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(chat.id);
              }}
            >
              {t("Delete")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </Link>
  );
}
