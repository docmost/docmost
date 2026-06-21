import React, { useEffect, useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Menu,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  getDefaultZIndex,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import {
  IconBuilding,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFile,
  IconFileDescription,
  IconSearch,
} from "@tabler/icons-react";
import DOMPurify from "dompurify";
import { buildPageUrl } from "@/features/page/page.utils";
import { getAppName } from "@/lib/config";
import { getPageIcon } from "@/lib";
import { useUnifiedSearch } from "@/features/search/hooks/use-unified-search";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import {
  IAttachmentSearch,
  IPageBreadcrumb,
  IPageSearch,
} from "@/features/search/types/search.types";

const PAGE_SIZE = 25;

export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasAttachmentIndexing = useHasFeature(Feature.ATTACHMENT_INDEXING);

  const initialQuery = searchParams.get("q") || "";
  const initialSpaceId = searchParams.get("spaceId") || null;
  const initialType = searchParams.get("type") || "page";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  const [inputValue, setInputValue] = useState(initialQuery);
  const [debouncedQuery] = useDebouncedValue(inputValue, 300);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(
    initialSpaceId,
  );
  const [contentType, setContentType] = useState(initialType);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [spaceSearchQuery, setSpaceSearchQuery] = useState("");
  const [debouncedSpaceQuery] = useDebouncedValue(spaceSearchQuery, 300);

  const { data: spacesData } = useGetSpacesQuery({
    limit: 100,
    query: debouncedSpaceQuery,
  });

  const selectedSpace = spacesData?.items?.find(
    (s) => s.id === selectedSpaceId,
  );

  // Reset page when query/filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, selectedSpaceId, contentType]);

  // Keep URL params in sync
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (selectedSpaceId) params.spaceId = selectedSpaceId;
    if (contentType !== "page") params.type = contentType;
    if (currentPage > 1) params.page = String(currentPage);
    setSearchParams(params, { replace: true });
  }, [debouncedQuery, selectedSpaceId, contentType, currentPage, setSearchParams]);

  const offset = (currentPage - 1) * PAGE_SIZE;

  const { data: results, isLoading } = useUnifiedSearch(
    {
      query: debouncedQuery,
      spaceId: selectedSpaceId || undefined,
      contentType,
      limit: PAGE_SIZE,
      offset,
    },
    !!debouncedQuery,
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const isAttachmentSearch =
    contentType === "attachment" && hasAttachmentIndexing;

  const contentTypeOptions = [
    { value: "page", label: t("Pages") },
    {
      value: "attachment",
      label: t("Attachments"),
      disabled: !hasAttachmentIndexing,
    },
  ];

  const hasMore = (results?.length || 0) === PAGE_SIZE;
  const hasPrev = currentPage > 1;

  return (
    <>
      <Helmet>
        <title>
          {debouncedQuery
            ? `${t("Search")}: ${debouncedQuery}`
            : t("Search")}{" "}
          - {getAppName()}
        </title>
      </Helmet>

      <Container size="800" pt="xl" pb="xl">
        <Title order={3} mb="lg">
          {t("Search")}
        </Title>

        {/* Search input */}
        <form onSubmit={handleSearch}>
          <TextInput
            size="md"
            leftSection={<IconSearch size={18} />}
            placeholder={t("Search...")}
            value={inputValue}
            onChange={(e) => setInputValue(e.currentTarget.value)}
            autoFocus
            mb="md"
          />
        </form>

        {/* Filters */}
        <Group mb="lg" gap="xs">
          {/* Space filter */}
          <Menu
            shadow="md"
            width={250}
            position="bottom-start"
            zIndex={getDefaultZIndex("popover")}
          >
            <Menu.Target>
              <Button
                variant="light"
                color="gray"
                size="sm"
                rightSection={<IconChevronDown size={14} />}
                leftSection={<IconBuilding size={16} />}
              >
                {selectedSpaceId
                  ? `${t("Space")}: ${selectedSpace?.name || t("Unknown")}`
                  : `${t("Space")}: ${t("All spaces")}`}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <TextInput
                placeholder={t("Find a space")}
                autoFocus
                leftSection={<IconSearch size={16} />}
                value={spaceSearchQuery}
                onChange={(e) => setSpaceSearchQuery(e.target.value)}
                size="sm"
                variant="filled"
                radius="sm"
                m="xs"
              />
              <ScrollArea.Autosize mah={280}>
                <Menu.Item onClick={() => setSelectedSpaceId(null)}>
                  <Group gap="xs">
                    <Text size="sm" style={{ flex: 1 }}>
                      {t("All spaces")}
                    </Text>
                    {!selectedSpaceId && <IconCheck size={16} />}
                  </Group>
                </Menu.Item>
                <Divider my="xs" />
                {(spacesData?.items || []).map((space) => (
                  <Menu.Item
                    key={space.id}
                    onClick={() => setSelectedSpaceId(space.id)}
                  >
                    <Group gap="xs">
                      <Text size="sm" style={{ flex: 1 }} truncate>
                        {space.name}
                      </Text>
                      {selectedSpaceId === space.id && (
                        <IconCheck size={16} />
                      )}
                    </Group>
                  </Menu.Item>
                ))}
              </ScrollArea.Autosize>
            </Menu.Dropdown>
          </Menu>

          {/* Type filter */}
          <Menu
            shadow="md"
            width={200}
            position="bottom-start"
            zIndex={getDefaultZIndex("popover")}
          >
            <Menu.Target>
              <Button
                variant="light"
                color="gray"
                size="sm"
                rightSection={<IconChevronDown size={14} />}
                leftSection={<IconFileDescription size={16} />}
              >
                {contentType === "page" ? t("Pages") : t("Attachments")}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {contentTypeOptions.map((opt) => (
                <Menu.Item
                  key={opt.value}
                  disabled={opt.disabled}
                  onClick={() => !opt.disabled && setContentType(opt.value)}
                >
                  <Group gap="xs">
                    <div style={{ flex: 1 }}>
                      <Text size="sm">{opt.label}</Text>
                      {opt.disabled && (
                        <Badge size="xs" mt={2}>
                          {t("Enterprise")}
                        </Badge>
                      )}
                    </div>
                    {contentType === opt.value && <IconCheck size={16} />}
                  </Group>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* Results */}
        {!debouncedQuery && (
          <Center py="xl">
            <Text c="dimmed">{t("Start typing to search...")}</Text>
          </Center>
        )}

        {debouncedQuery && isLoading && (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        )}

        {debouncedQuery && !isLoading && (results?.length || 0) === 0 && (
          <Center py="xl">
            <Text c="dimmed">{t("No results found...")}</Text>
          </Center>
        )}

        {(results?.length || 0) > 0 && (
          <Stack gap={0}>
            <Text size="sm" c="dimmed" mb="sm">
              {t("Results for \"{{query}}\"", { query: debouncedQuery })}
              {currentPage > 1 && ` — ${t("page {{page}}", { page: currentPage })}`}
            </Text>

            {results!.map((result, i) =>
              isAttachmentSearch ? (
                <AttachmentResultCard
                  key={result.id}
                  result={result as IAttachmentSearch}
                  showDivider={i < results!.length - 1}
                />
              ) : (
                <PageResultCard
                  key={result.id}
                  result={result as IPageSearch}
                  showDivider={i < results!.length - 1}
                  showSpace={!selectedSpaceId}
                />
              ),
            )}

            {/* Pagination */}
            <Group justify="center" mt="xl" gap="xs">
              <Tooltip label={t("Previous page")} withArrow>
                <ActionIcon
                  variant="default"
                  disabled={!hasPrev}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  aria-label={t("Previous page")}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
              </Tooltip>

              <Text size="sm" c="dimmed" px="xs">
                {t("Page {{page}}", { page: currentPage })}
              </Text>

              <Tooltip label={t("Next page")} withArrow>
                <ActionIcon
                  variant="default"
                  disabled={!hasMore}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  aria-label={t("Next page")}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Stack>
        )}
      </Container>
    </>
  );
}

function PageResultCard({
  result,
  showDivider,
  showSpace,
}: {
  result: IPageSearch;
  showDivider: boolean;
  showSpace: boolean;
}) {
  const { t } = useTranslation();
  const url = buildPageUrl(result.space.slug, result.slugId, result.title);

  return (
    <>
      <Box
        component={Link}
        to={url}
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          padding: "12px 0",
          borderRadius: 8,
        }}
      >
        <Group gap="xs" mb={4} wrap="nowrap">
          <Box style={{ flexShrink: 0 }}>{getPageIcon(result.icon)}</Box>
          <Text fw={600} size="md" style={{ flex: 1 }} lineClamp={1}>
            {result.title || t("Untitled")}
          </Text>
        </Group>

        <Group gap={4} mb={6} ml={24} wrap="nowrap" align="center">
          {showSpace && result.space?.name && (
            <Badge variant="light" size="xs" color="blue" style={{ flexShrink: 0 }}>
              {result.space.name}
            </Badge>
          )}
          {(result.breadcrumbs ?? []).map((crumb, i) => (
            <React.Fragment key={crumb.id}>
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>/</Text>
              <Anchor
                component={Link}
                to={buildPageUrl(result.space.slug, crumb.slugId, crumb.title)}
                size="xs"
                c="dimmed"
                underline="hover"
                onClick={(e) => e.stopPropagation()}
                style={{ flexShrink: 0 }}
              >
                {crumb.icon ? `${crumb.icon} ${crumb.title || t("Untitled")}` : (crumb.title || t("Untitled"))}
              </Anchor>
            </React.Fragment>
          ))}
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>·</Text>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {t("Updated")} {new Date(result.updatedAt).toLocaleDateString()}
          </Text>
        </Group>

        {result.highlight && (
          <Text
            size="sm"
            c="dimmed"
            ml={24}
            lineClamp={3}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(result.highlight, {
                ALLOWED_TAGS: ["mark", "em", "strong", "b"],
                ALLOWED_ATTR: [],
              }),
            }}
          />
        )}
      </Box>
      {showDivider && <Divider />}
    </>
  );
}

function AttachmentResultCard({
  result,
  showDivider,
}: {
  result: IAttachmentSearch;
  showDivider: boolean;
}) {
  const { t } = useTranslation();
  const pageUrl = buildPageUrl(
    result.space.slug,
    result.page.slugId,
    result.page.title,
  );
  const downloadUrl = `/api/files/${result.id}/${result.fileName}`;

  return (
    <>
      <Box
        component={Link}
        to={pageUrl}
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          padding: "12px 0",
          borderRadius: 8,
        }}
      >
        <Group gap="xs" mb={4} wrap="nowrap">
          <Box style={{ flexShrink: 0 }}>
            <IconFile size={18} />
          </Box>
          <Text fw={600} size="md" style={{ flex: 1 }} lineClamp={1}>
            {result.fileName}
          </Text>
          <Tooltip label={t("Download attachment")} withArrow>
            <ActionIcon
              component="a"
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              variant="subtle"
              color="gray"
              onClick={(e) => e.stopPropagation()}
            >
              <IconFile size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group gap="xs" mb={6} ml={24}>
          {result.space?.name && (
            <Badge variant="light" size="xs" color="blue">
              {result.space.name}
            </Badge>
          )}
          {result.page?.title && (
            <Badge variant="light" size="xs" color="gray">
              {result.page.title}
            </Badge>
          )}
          <Text size="xs" c="dimmed">
            {t("Updated")} {new Date(result.updatedAt).toLocaleDateString()}
          </Text>
        </Group>

        {result.highlight && (
          <Text
            size="sm"
            c="dimmed"
            ml={24}
            lineClamp={3}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(result.highlight, {
                ALLOWED_TAGS: ["mark", "em", "strong", "b"],
                ALLOWED_ATTR: [],
              }),
            }}
          />
        )}
      </Box>
      {showDivider && <Divider />}
    </>
  );
}
