import { Spotlight } from "@mantine/spotlight";
import { IconSearch, IconSparkles } from "@tabler/icons-react";
import { Group, Button, VisuallyHidden, Text } from "@mantine/core";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { searchSpotlightStore } from "../constants.ts";
import { SearchSpotlightFilters } from "./search-spotlight-filters.tsx";
import { useUnifiedSearch } from "../hooks/use-unified-search.ts";
import { useAiSearch } from "../../../ee/ai/hooks/use-ai-search.ts";
import { SearchResultItem } from "./search-result-item.tsx";
import { AiSearchResult } from "../../../ee/ai/components/ai-search-result.tsx";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useAtomValue } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { hintVectorCache } from "@/ee/ai/services/ai-search-service.ts";
import { getAiVectorDriver } from "@/lib/config.ts";

interface SearchSpotlightProps {
  spaceId?: string;
}
export function SearchSpotlight({ spaceId }: SearchSpotlightProps) {
  const workspace = useAtomValue(workspaceAtom);
  const { t } = useTranslation();
  const hasAiFeature = useHasFeature(Feature.AI);
  const hasAttachmentIndexing = useHasFeature(Feature.ATTACHMENT_INDEXING);
  const [query, setQuery] = useState("");
  const [debouncedSearchQuery] = useDebouncedValue(query, 300);
  const [filters, setFilters] = useState<{
    spaceId?: string | null;
    contentType?: string;
    creatorId?: string | null;
    labelIds?: string[];
    titleOnly?: boolean;
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

    if (filters.creatorId) {
      params.creatorId = filters.creatorId;
    }

    if (filters.labelIds?.length) {
      params.labelIds = filters.labelIds;
    }

    if (filters.titleOnly) {
      params.titleOnly = true;
    }

    return params;
  }, [debouncedSearchQuery, filters]);

  const {
    data: searchResults,
    isFetching,
  } = useUnifiedSearch(
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

  const isFilterBrowse =
    (filters.labelIds?.length ?? 0) > 0 || !!filters.creatorId;
  // while the debounce is pending the empty list is not a settled "no results"
  const isQuerySettled = query === debouncedSearchQuery;

  // Determine result type for rendering
  const isAttachmentSearch =
    filters.contentType === "attachment" && hasAttachmentIndexing;

  const resultItems = (searchResults || []).map((result) => (
    <SearchResultItem
      key={result.id}
      result={result}
      isAttachmentResult={isAttachmentSearch}
      showSpace={!filters.spaceId}
    />
  ));

  const handleSpotlightOpen = () => {
    if (
      workspace?.settings?.ai?.search === true &&
      getAiVectorDriver() === "turbopuffer"
    ) {
      hintVectorCache();
    }
  };

  const handleFiltersChange = useCallback((newFilters: any) => {
    setFilters(newFilters);
  }, [setFilters]);

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
        onSpotlightOpen={handleSpotlightOpen}
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
            aria-label={isAiMode ? t("Ask a question...") : t("Search")}
            leftSection={<IconSearch size={20} stroke={1.5} />}
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isAiMode && query.trim() && !isAiLoading) {
                e.preventDefault();
                handleAiSearchTrigger();
              }
            }}
          />
          {isAiMode && hasAiFeature && (
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

        <VisuallyHidden role="status" aria-live="polite">
          {isAiMode
            ? query.length > 0 && !isAiLoading && !aiSearchResult
              ? t("No answer available")
              : ""
            : (query.length > 0 || isFilterBrowse) && !isFetching
              ? resultItems.length === 0
                ? t("No results found")
                : t("{{count}} results found", { count: resultItems.length })
              : ""}
        </VisuallyHidden>

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
              {query.length === 0 && !isFilterBrowse && resultItems.length === 0 && (
                <Spotlight.Empty>{t("Start typing to search...")}</Spotlight.Empty>
              )}

              {(query.length > 0 || isFilterBrowse) &&
                !isFetching &&
                isQuerySettled &&
                resultItems.length === 0 && (
                  <Spotlight.Empty>{t("No results found...")}</Spotlight.Empty>
                )}

              {resultItems.length > 0 && <>{resultItems}</>}

              {(query.length > 0 || isFilterBrowse) &&
                isFetching &&
                resultItems.length === 0 && (
                <Spotlight.Empty>
                  <Text size="sm" style={{ marginTop: 10 }}>
                    {t("Searching...")}
                  </Text>
                </Spotlight.Empty>
              )}
            </>
          )}
        </Spotlight.ActionsList>
      </Spotlight.Root>
    </>
  );
}
