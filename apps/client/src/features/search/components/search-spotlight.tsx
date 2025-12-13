import { Spotlight } from "@mantine/spotlight";
import { IconSearch, IconSparkles } from "@tabler/icons-react";
import { Group, Button } from "@mantine/core";
import React, { useState, useMemo, useEffect } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { searchSpotlightStore } from "../constants.ts";
import { SearchSpotlightFilters } from "./search-spotlight-filters.tsx";
import { useUnifiedSearch } from "../hooks/use-unified-search.ts";
import { useAiSearch } from "../../../ee/ai/hooks/use-ai-search.ts";
import { SearchResultItem } from "./search-result-item.tsx";
import { AiSearchResult } from "../../../ee/ai/components/ai-search-result.tsx";
import { useLicense } from "@/ee/hooks/use-license.tsx";
import { isCloud } from "@/lib/config.ts";

interface SearchSpotlightProps {
  spaceId?: string;
}
export function SearchSpotlight({ spaceId }: SearchSpotlightProps) {
  const { t } = useTranslation();
  const { hasLicenseKey } = useLicense();
  const [query, setQuery] = useState("");
  const [debouncedSearchQuery] = useDebouncedValue(query, 300);
  const [filters, setFilters] = useState<{
    spaceId?: string | null;
    contentType?: string;
  }>({
    contentType: "page",
  });
  const [isAiMode, setIsAiMode] = useState(false);

  // Build unified search params
  const searchParams = useMemo(() => {
    const params: any = {
      query: debouncedSearchQuery,
      contentType: filters.contentType || "page", // Only used for frontend routing
    };

    // Handle space filtering - only pass spaceId if a specific space is selected
    if (filters.spaceId) {
      params.spaceId = filters.spaceId;
    }

    return params;
  }, [debouncedSearchQuery, filters]);

  const { data: searchResults, isLoading } = useUnifiedSearch(
    searchParams,
    !isAiMode // Disable regular search when in AI mode
  );
  const {
    //@ts-ignore
    data: aiSearchResult,
    //@ts-ignore
    isPending: isAiLoading,
    //@ts-ignore
    mutate: triggerAiSearchMutation,
    //@ts-ignore
    reset: resetAiMutation,
    //@ts-ignore
    error: aiSearchError,
    streamingAnswer,
    streamingSources,
    clearStreaming,
  } = useAiSearch();

  // Clear streaming state and mutation data when query changes (user is typing a new query)
  useEffect(() => {
    clearStreaming();
    resetAiMutation();
  }, [query, clearStreaming, resetAiMutation]);

  // Show error notification when AI search fails
  useEffect(() => {
    if (aiSearchError) {
      notifications.show({
        message: aiSearchError.message || t("AI search failed. Please try again."),
        color: "red",
        position: "top-center"
      });
    }
  }, [aiSearchError, t]);

  // Determine result type for rendering
  const isAttachmentSearch =
    filters.contentType === "attachment" && (hasLicenseKey || isCloud());

  const resultItems = (searchResults || []).map((result) => (
    <SearchResultItem
      key={result.id}
      result={result}
      isAttachmentResult={isAttachmentSearch}
      showSpace={!filters.spaceId}
    />
  ));

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleAskClick = () => {
    setIsAiMode(!isAiMode);
  };

  const handleAiSearchTrigger = () => {
    if (query.trim() && isAiMode) {
      triggerAiSearchMutation(searchParams);
    }
  };

  return (
    <>
      <Spotlight.Root
        size="xl"
        maxHeight={600}
        store={searchSpotlightStore}
        query={query}
        onQueryChange={setQuery}
        scrollable
        overlayProps={{
          backgroundOpacity: 0.55,
        }}
      >
        <Group gap="xs" px="sm" pt="sm" pb="xs">
          <Spotlight.Search
            placeholder={isAiMode ? t("Ask a question...") : t("Search...")}
            leftSection={<IconSearch size={20} stroke={1.5} />}
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isAiMode && query.trim() && !isAiLoading) {
                e.preventDefault();
                handleAiSearchTrigger();
              }
            }}
          />
          {isAiMode && hasLicenseKey && (
            <Button
              size="xs"
              leftSection={<IconSparkles size={16} />}
              onClick={handleAiSearchTrigger}
              disabled={!query.trim()}
              loading={isAiLoading}
            >
              Ask
            </Button>
          )}
        </Group>

        <div
          style={{
            padding: "4px 16px",
          }}
        >
          <SearchSpotlightFilters
            onFiltersChange={handleFiltersChange}
            onAskClick={handleAskClick}
            spaceId={spaceId}
            isAiMode={isAiMode}
          />
        </div>

        <Spotlight.ActionsList>
          {isAiMode ? (
            <>
              {query.length === 0 && (
                <Spotlight.Empty>{t("Ask a question...")}</Spotlight.Empty>
              )}
              {query.length > 0 && (isAiLoading || aiSearchResult || streamingAnswer) && (
                <AiSearchResult
                  result={aiSearchResult}
                  isLoading={isAiLoading}
                  streamingAnswer={streamingAnswer}
                  streamingSources={streamingSources}
                />
              )}
              {query.length > 0 && !isAiLoading && !aiSearchResult && (
                <Spotlight.Empty>{t("No answer available")}</Spotlight.Empty>
              )}
            </>
          ) : (
            <>
              {query.length === 0 && resultItems.length === 0 && (
                <Spotlight.Empty>{t("Start typing to search...")}</Spotlight.Empty>
              )}

              {query.length > 0 && !isLoading && resultItems.length === 0 && (
                <Spotlight.Empty>{t("No results found...")}</Spotlight.Empty>
              )}

              {resultItems.length > 0 && <>{resultItems}</>}
            </>
          )}
        </Spotlight.ActionsList>
      </Spotlight.Root>
    </>
  );
}
