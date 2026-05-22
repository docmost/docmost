import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Center,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconChevronDown,
  IconLabel,
  IconSearch,
} from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { useDebouncedValue } from "@mantine/hooks";
import { getAppName } from "@/lib/config";
import { useLabelPagesQuery } from "@/features/label/queries/label-query.ts";
import { useGetSpacesQuery } from "@/features/space/queries/space-query.ts";
import { getLabelColor } from "@/features/label/utils/label-colors.ts";
import { LabelPageRow } from "@/features/label/components/label-page-row.tsx";
import { LabelPageRowSkeleton } from "@/features/label/components/label-page-row-skeleton.tsx";
import { normalizeLabelName } from "@/features/label/utils/normalize-label.ts";
import { SpaceFilterMenu } from "@/features/space/components/space-filter-menu.tsx";
import { EmptyState } from "@/components/ui/empty-state";
import classes from "@/features/label/label.module.css";

export default function LabelPage() {
  const { t } = useTranslation();
  const { labelName: rawName } = useParams<{ labelName: string }>();
  const labelName = normalizeLabelName(decodeURIComponent(rawName ?? ""));
  const scheme = useComputedColorScheme("light");
  const c = getLabelColor(labelName, scheme);

  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 200);

  const activeSpaceId = spaceId ?? undefined;

  const { data: spacesData } = useGetSpacesQuery({ limit: 100 });
  const spaces = spacesData?.items ?? [];

  const {
    data: pagesData,
    isLoading: pagesLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useLabelPagesQuery(labelName, debouncedSearch, activeSpaceId);

  const pages = useMemo(
    () => pagesData?.pages.flatMap((p) => p.items) ?? [],
    [pagesData],
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const selectedSpaceName = useMemo(() => {
    if (!spaceId) return t("All spaces");
    return spaces.find((s) => s.id === spaceId)?.name ?? t("All spaces");
  }, [spaceId, spaces, t]);

  return (
    <>
      <Helmet>
        <title>
          {labelName} - {getAppName()}
        </title>
      </Helmet>

      <Container size={820} py="xl">
        <Stack gap="lg">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {t("Labels")}
              {" / "}
              <Text component="span" c="bright" fw={500}>
                {labelName}
              </Text>
            </Text>

            <Group gap="md" align="center" wrap="nowrap">
              <Link
                to={`/labels/${encodeURIComponent(labelName)}`}
                className={classes.headerChip}
                style={{ background: c.bg, color: c.fg }}
              >
                <span
                  className={classes.headerDot}
                  style={{ background: c.dot }}
                />
                <span>{labelName}</span>
              </Link>
            </Group>
          </Stack>

          <Group gap="sm" wrap="nowrap" align="center">
            <TextInput
              placeholder={t("Search by title")}
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="sm"
              style={{ flex: 1 }}
            />
            <SpaceFilterMenu value={spaceId} onChange={setSpaceId}>
              <Button
                variant="default"
                size="sm"
                rightSection={<IconChevronDown size={14} />}
              >
                {selectedSpaceName}
              </Button>
            </SpaceFilterMenu>
          </Group>

          {pagesLoading && pages.length === 0 ? (
            <div>
              <LabelPageRowSkeleton titleWidth={260} metaWidth={170} />
              <LabelPageRowSkeleton titleWidth={180} metaWidth={150} />
              <LabelPageRowSkeleton titleWidth={220} metaWidth={190} />
              <LabelPageRowSkeleton titleWidth={140} metaWidth={140} />
              <LabelPageRowSkeleton titleWidth={240} metaWidth={170} />
            </div>
          ) : pages.length > 0 ? (
            <div>
              {pages.map((page) => (
                <LabelPageRow
                  key={page.id}
                  page={page}
                  currentLabelName={labelName}
                />
              ))}
              <div ref={sentinelRef} />
              {isFetchingNextPage && (
                <Center py="md">
                  <Loader size="sm" />
                </Center>
              )}
            </div>
          ) : (
            <EmptyState
              icon={IconLabel}
              title={
                debouncedSearch
                  ? t("No matches")
                  : t("No pages with this label")
              }
              description={
                debouncedSearch
                  ? t("No pages match your search.")
                  : t("Pages tagged with this label will appear here.")
              }
            />
          )}
        </Stack>
      </Container>
    </>
  );
}
