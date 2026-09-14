import { Group, Center, Text, Button } from "@mantine/core";
import { Spotlight } from "@mantine/spotlight";
import { IconLetterCase, IconSearch } from "@tabler/icons-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useDebouncedValue } from "@mantine/hooks";
import { usePublicSpaceSearchQuery } from "@/features/search/queries/search-query";
import { buildPublicSpaceUrl } from "@/features/page/page.utils.ts";
import { getPageIcon } from "@/lib";
import { useTranslation } from "react-i18next";
import { publicSpaceSearchSpotlightStore } from "@/features/search/constants.ts";
import DOMPurify from "dompurify";

interface PublicSpaceSearchSpotlightProps {
  spaceSlug: string;
}
export function PublicSpaceSearchSpotlight({
  spaceSlug,
}: PublicSpaceSearchSpotlightProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [titleOnly, setTitleOnly] = useState(false);
  const [debouncedSearchQuery] = useDebouncedValue(query, 300);

  const { data: searchResults } = usePublicSpaceSearchQuery({
    query: debouncedSearchQuery,
    spaceSlug,
    ...(titleOnly && { titleOnly: true }),
  });

  const pages = (
    searchResults && searchResults.length > 0 ? searchResults : []
  ).map((page) => (
    <Spotlight.Action
      key={page.id}
      component={Link}
      //@ts-ignore
      to={buildPublicSpaceUrl({
        spaceSlug: spaceSlug,
        pageTitle: page.title,
        pageSlugId: page.slugId,
      })}
      style={{ userSelect: "none" }}
    >
      <Group wrap="nowrap" w="100%">
        <Center>{getPageIcon(page?.icon)}</Center>

        <div style={{ flex: 1 }}>
          <Text>{page.title}</Text>

          {page?.highlight && (
            <Text
              opacity={0.6}
              size="xs"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(page.highlight, {
                  ALLOWED_TAGS: ["mark", "em", "strong", "b"],
                  ALLOWED_ATTR: [],
                }),
              }}
            />
          )}
        </div>
      </Group>
    </Spotlight.Action>
  ));

  return (
    <>
      <Spotlight.Root
        store={publicSpaceSearchSpotlightStore}
        query={query}
        onQueryChange={setQuery}
        scrollable
        overlayProps={{
          backgroundOpacity: 0.55,
        }}
      >
        <Spotlight.Search
          placeholder={t("Search...")}
          aria-label={t("Search")}
          leftSection={<IconSearch size={20} stroke={1.5} />}
        />
        <Group px="sm" py={6}>
          <Button
            variant={titleOnly ? "light" : "subtle"}
            color={titleOnly ? undefined : "gray"}
            size="compact-sm"
            radius="xl"
            fw={500}
            leftSection={<IconLetterCase size={15} />}
            aria-pressed={titleOnly}
            onClick={() => setTitleOnly((value) => !value)}
          >
            {t("Title only")}
          </Button>
        </Group>
        <Spotlight.ActionsList>
          {query.length === 0 && pages.length === 0 && (
            <Spotlight.Empty>{t("Start typing to search...")}</Spotlight.Empty>
          )}

          {query.length > 0 && pages.length === 0 && (
            <Spotlight.Empty>{t("No results found...")}</Spotlight.Empty>
          )}

          {pages.length > 0 && pages}
        </Spotlight.ActionsList>
      </Spotlight.Root>
    </>
  );
}
