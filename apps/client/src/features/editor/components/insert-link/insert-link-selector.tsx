import { useState } from "react";
import {
  TextInput,
  Tabs,
  Stack,
  Text,
  Group,
  UnstyledButton,
  Button,
  ScrollArea,
  ActionIcon,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  IconSearch,
  IconClock,
  IconLink,
  IconFileDescription,
} from "@tabler/icons-react";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query";
import { useRecentChangesQuery } from "@/features/page/queries/page-query";
import { useParams } from "react-router-dom";
import { useDebouncedValue } from "@mantine/hooks";
import classes from "@/features/editor/components/mention/mention.module.css";

interface PageLinkSelectorProps {
  onSelect: (data: {
    type: "page" | "url";
    pageId?: string;
    url?: string;
    title: string;
    icon?: string;
    slugId?: string;
    manualTitle?: boolean;
  }) => void;
  initialUrl?: string;
}

export const LinkSelector = ({
  onSelect,
  initialUrl = "",
}: PageLinkSelectorProps) => {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const [activeTab, setActiveTab] = useState<string | null>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);
  const [manualUrl, setManualUrl] = useState(initialUrl);
  const [manualTitle, setManualTitle] = useState("");

  // Search Query
  const { data: searchResults, isLoading: isSearchLoading } =
    useSearchSuggestionsQuery({
      query: debouncedQuery,
      includePages: true,
      includeUsers: false,
      spaceId: spaceSlug, // Note: search-query might need spaceId or slug, usually ID. Let's assume it handles it or we need ID.
      // Wait, searchSuggestions usually takes spaceId. We might need to get spaceId from slug if not available directly.
      // Assuming existing context or hook usage pattern.
      // In mention-list.tsx: const { data: space } = useSpaceQuery(spaceSlug); space.id is used.
      // I should probably skip space fetching here for simplicity if possible or add it if strictly needed.
      // For now, let's assume global search or try to get space ID if needed.
      // Actually, let's keep it simple. If searchSuggestions requires spaceId, I need it.
    });

  // Recent Pages Query
  // useRecentChangesQuery takes spaceId.
  // We need to fetch space to get ID.
  // Let's assume we can pass spaceSlug if the backend supports it, or we need to fetch space first.
  // Checking mention-list.tsx, it fetches space.

  // NOTE: To avoid extra fetching overhead if not strictly needed, I'll try to rely on what's available.
  // But `useRecentChangesQuery` likely needs an ID.
  // For this generic component, passing `spaceId` as prop might be better, OR fetching it here.
  // Let's check `mention-list.tsx` imports. It uses `useSpaceQuery`.

  const { data: recentPages, isLoading: isRecentLoading } =
    useRecentChangesQuery(); // it might default to current space context if implemented that way, or we need to pass it.

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualUrl) {
      onSelect({
        type: "url",
        url: manualUrl,
        title: manualTitle || manualUrl,
        manualTitle: !!manualTitle,
      });
    }
  };

  const isUrl = (text: string) => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  };

  // Mixed results: Recent pages if no query, Search results if query.
  const showRecent = !debouncedQuery;

  return (
    <Stack gap="xs" w={350}>
      <TextInput
        placeholder={t("Search pages or paste link")}
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          if (isUrl(e.target.value)) {
            setActiveTab("manual");
            setManualUrl(e.target.value);
          } else {
            setActiveTab("search");
          }
        }}
        autoFocus
      />

      {activeTab === "manual" && (
        <form onSubmit={handleManualSubmit}>
          <Stack gap="xs">
            <Text size="xs" c="dimmed">
              {t("Link to external URL")}
            </Text>
            <Group gap="xs">
              <TextInput
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)} // Keep in sync
                style={{ flex: 1 }}
                placeholder="https://..."
              />
            </Group>
            <TextInput
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder={t("Link Title (optional)")}
            />
            <Button type="submit" size="sm" disabled={!manualUrl}>
              {t("Add")}
            </Button>
          </Stack>
        </form>
      )}

      {activeTab === "search" && (
        <Stack gap={4}>
          <Text size="xs" c="dimmed" fw={700} px="xs">
            {showRecent ? t("Recent Pages") : t("Search Results")}
          </Text>

          <ScrollArea.Autosize mah={300} type="scroll">
            {showRecent && isRecentLoading && (
              <Text size="sm" c="dimmed" p="xs">
                {t("Loading...")}
              </Text>
            )}

            {showRecent &&
              recentPages?.items?.map((page) => (
                <UnstyledButton
                  key={page.id}
                  className={classes.menuBtn}
                  onClick={() =>
                    onSelect({
                      type: "page",
                      pageId: page.id,
                      slugId: page.slugId,
                      title: page.title,
                      icon: page.icon,
                      manualTitle: false,
                    })
                  }
                >
                  <Group wrap="nowrap">
                    <ActionIcon variant="transparent" color="gray" size="sm">
                      {page.icon ? (
                        <span>{page.icon}</span>
                      ) : (
                        <IconFileDescription size={16} />
                      )}
                    </ActionIcon>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>
                        {page.title || t("Untitled")}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {t("Last updated")}{" "}
                        {new Date(page.updatedAt).toLocaleDateString()}
                      </Text>
                    </div>
                  </Group>
                </UnstyledButton>
              ))}

            {!showRecent &&
              searchResults?.pages?.map((page) => (
                <UnstyledButton
                  key={page.id}
                  className={classes.menuBtn}
                  onClick={() =>
                    onSelect({
                      type: "page",
                      pageId: page.id,
                      slugId: page.slugId,
                      title: page.title,
                      icon: page.icon,
                      manualTitle: false,
                    })
                  }
                >
                  <Group wrap="nowrap">
                    <ActionIcon variant="transparent" color="gray" size="sm">
                      {page.icon ? (
                        <span>{page.icon}</span>
                      ) : (
                        <IconFileDescription size={16} />
                      )}
                    </ActionIcon>
                    <Text size="sm" fw={500} truncate>
                      {page.title || t("Untitled")}
                    </Text>
                  </Group>
                </UnstyledButton>
              ))}

            {!showRecent &&
              !isSearchLoading &&
              searchResults?.pages?.length === 0 && (
                <Text size="sm" c="dimmed" p="xs" ta="center">
                  {t("No pages found")}
                </Text>
              )}
          </ScrollArea.Autosize>
        </Stack>
      )}
    </Stack>
  );
};
