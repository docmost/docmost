import { Spotlight } from "@mantine/spotlight";
import { IconSearch } from "@tabler/icons-react";
import React, { useState, useMemo } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { searchSpotlightStore } from "../constants.ts";
import { SearchSpotlightFilters } from "./search-spotlight-filters.tsx";
import { useUnifiedSearch } from "../hooks/use-unified-search.ts";
import { SearchResultItem } from "./search-result-item.tsx";
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

  const { data: searchResults, isLoading } = useUnifiedSearch(searchParams);

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
        <Spotlight.Search
          placeholder={t("Search...")}
          leftSection={<IconSearch size={20} stroke={1.5} />}
        />

        <div
          style={{
            padding: "4px 16px",
          }}
        >
          <SearchSpotlightFilters
            onFiltersChange={handleFiltersChange}
            spaceId={spaceId}
          />
        </div>

        <Spotlight.ActionsList>
          {query.length === 0 && resultItems.length === 0 && (
            <Spotlight.Empty>{t("Start typing to search...")}</Spotlight.Empty>
          )}

          {query.length > 0 && !isLoading && resultItems.length === 0 && (
            <Spotlight.Empty>{t("No results found...")}</Spotlight.Empty>
          )}

          {resultItems.length > 0 && <>{resultItems}</>}
        </Spotlight.ActionsList>
      </Spotlight.Root>
    </>
  );
}
