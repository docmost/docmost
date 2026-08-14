import { Spotlight } from "@mantine/spotlight";
import { IconSearch, IconSparkles } from "@tabler/icons-react";
import { Group, Button, VisuallyHidden, Center, Text } from "@mantine/core";
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
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useLinearIssueSearchQuery } from "@/features/linear/queries/linear-query";
import LinearIcon from "@/components/icons/linear-icon.tsx";
import { sanitizeUrl } from "@docmost/editor-ext";

interface SearchSpotlightProps {
  spaceId?: string;
}
export function SearchSpotlight({ spaceId }: SearchSpotlightProps) {
  const { t } = useTranslation();
  const hasAiFeature = useHasFeature(Feature.AI);
  const hasAttachmentIndexing = useHasFeature(Feature.ATTACHMENT_INDEXING);
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
    filters.contentType === "attachment" && hasAttachmentIndexing;

  const resultItems = (searchResults || []).map((result) => (
    <SearchResultItem
      key={result.id}
      result={result}
      isAttachmentResult={isAttachmentSearch}
      showSpace={!filters.spaceId}
    />
  ));

  const { data: linearData } = useLinearIssueSearchQuery(
    isAiMode ? "" : debouncedSearchQuery,
  );
  const linearIssues = linearData?.connected ? linearData.issues : [];

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
            : query.length > 0 && !isLoading
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
              {query.length === 0 && resultItems.length === 0 && (
                <Spotlight.Empty>{t("Start typing to search...")}</Spotlight.Empty>
              )}

              {query.length > 0 &&
                !isLoading &&
                resultItems.length === 0 &&
                linearIssues.length === 0 && (
                  <Spotlight.Empty>{t("No results found...")}</Spotlight.Empty>
                )}

              {resultItems.length > 0 && <>{resultItems}</>}

              {linearIssues.length > 0 && (
                <Spotlight.ActionsGroup label={t("Linear")}>
                  {linearIssues.map((issue) => (
                    <Spotlight.Action
                      key={issue.id}
                      component="a"
                      //@ts-ignore
                      href={sanitizeUrl(issue.url) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ userSelect: "none" }}
                    >
                      <Group wrap="nowrap" w="100%">
                        <Center>
                          <LinearIcon size={16} />
                        </Center>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Group gap="xs" wrap="nowrap">
                            <Text size="xs" opacity={0.6}>
                              {issue.identifier}
                            </Text>
                            <Text truncate>{issue.title}</Text>
                          </Group>
                        </div>
                      </Group>
                    </Spotlight.Action>
                  ))}
                </Spotlight.ActionsGroup>
              )}
            </>
          )}
        </Spotlight.ActionsList>
      </Spotlight.Root>
    </>
  );
}
