import { useState, useRef, useEffect } from "react";
import { ActionIcon, Menu, Popover, TextInput } from "@mantine/core";
import { IconDots, IconTrash, IconEdit } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import type { AiChat } from "../types/ai-chat.types";
import classes from "../styles/chat-sidebar.module.css";

type Props = {
  chat: AiChat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onRename: (chatId: string, title: string) => void;
};

export default function AiChatSidebarItem({
  chat,
  isActive,
  onDelete,
  onRename,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.select();
    }
  }, [renaming]);

  const startRename = () => {
    setRenameValue(chat.title || "");
    setRenaming(true);
  };

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== chat.title) {
      onRename(chat.id, trimmed);
    }
    setRenaming(false);
  };

  return (
    <Popover
      opened={renaming}
      onClose={() => setRenaming(false)}
      position="bottom-start"
      withinPortal
      trapFocus
    >
      <Popover.Target>
        <Link
          to={`/ai/chat/${chat.id}`}
          className={classes.chatItem}
          data-active={isActive || undefined}
        >
          <span className={classes.chatItemTitle}>
            {chat.title || "Untitled chat"}
          </span>
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
                    startRename();
                  }}
                >
                  Rename
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(chat.id);
                  }}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </Link>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <TextInput
          ref={inputRef}
          size="xs"
          placeholder="Chat name"
          value={renameValue}
          onChange={(e) => setRenameValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              submitRename();
            } else if (e.key === "Escape") {
              setRenaming(false);
            }
          }}
          onBlur={submitRename}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
