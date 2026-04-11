import { useState } from "react";
import { TextInput, Loader, Text, ScrollArea } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useChatsQuery, useSearchChatsQuery } from "../queries/ai-chat-query";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import classes from "../styles/aside-chat-panel.module.css";

type Props = {
  activeChatId: string | undefined;
  onSelect: (chatId: string) => void;
};

export default function AsideChatHistory({ activeChatId, onSelect }: Props) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  const chatsQuery = useChatsQuery();
  const searchQuery = useSearchChatsQuery(debouncedSearch);

  const isSearching = debouncedSearch.length > 0;
  const chats = isSearching
    ? (searchQuery.data ?? [])
    : (chatsQuery.data?.pages.flatMap((p) => p.items) ?? []);
  const isLoading = isSearching ? searchQuery.isLoading : chatsQuery.isLoading;

  return (
    <div>
      <TextInput
        placeholder={t("Search chats...")}
        leftSection={<IconSearch size={14} />}
        size="xs"
        mb="xs"
        value={searchValue}
        onChange={(e) => setSearchValue(e.currentTarget.value)}
      />

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
          <Loader size="sm" />
        </div>
      ) : chats.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          {isSearching ? t("No chats found") : t("No chat history")}
        </Text>
      ) : (
        <ScrollArea.Autosize mah={300} scrollbars="y">
          <div className={classes.historyList}>
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={classes.historyItem}
                data-active={chat.id === activeChatId || undefined}
                onClick={() => onSelect(chat.id)}
              >
                <span className={classes.historyItemTitle}>
                  {chat.title || t("Untitled chat")}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea.Autosize>
      )}
    </div>
  );
}
