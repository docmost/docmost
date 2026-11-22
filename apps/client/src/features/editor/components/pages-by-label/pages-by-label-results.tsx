import { Button, Group, Skeleton, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { PagesByLabelAttributes } from "@docmost/editor-ext";
import { useAtomValue } from "jotai";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PageListIcon } from "@/components/common/page-list-icon";
import { LabelChip } from "@/features/label/components/label-chip";
import { buildPageUrl } from "@/features/page/page.utils";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import api from "@/lib/api-client";
import { PagesByLabelContext } from "./pages-by-label-context";
import classes from "../subpages/subpages.module.css";
import styles from "./pages-by-label.module.css";

type PageResult = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  space: { id: string; slug: string; name: string };
  labels?: string[];
};

export function PagesByLabelResults({
  options,
}: {
  options: PagesByLabelAttributes;
}) {
  const { t } = useTranslation();
  const viewer = useAtomValue(userAtom);
  const host = useContext(PagesByLabelContext);
  const {
    labels,
    match,
    excludeLabels,
    scope,
    spaceIds,
    sortBy,
    sortDirection,
    limit,
    showLabels,
    excludeCurrentPage,
  } = options;
  const params = {
    labels,
    match,
    excludeLabels,
    scope,
    spaceIds,
    sortBy,
    sortDirection,
    limit,
    showLabels,
    excludeCurrentPage,
    pageId: host?.pageId,
    contextSpaceId: host?.spaceId ?? undefined,
  };
  const hasScope =
    scope === "workspace" ||
    (scope === "spaces"
      ? spaceIds.length > 0
      : !!(host?.pageId || host?.spaceId));
  const enabled = !!host && !!viewer && labels.length > 0 && hasScope;
  const query = useQuery({
    // Label mutations already invalidate every query with this prefix.
    queryKey: [
      "label-pages",
      {
        block: "pagesByLabel",
        workspaceId: viewer?.workspaceId,
        userId: viewer?.id,
      },
      params,
    ],
    queryFn: async () =>
      (await api.post<{ items: PageResult[] }>("/labels/query-pages", params))
        .data,
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });
  if (!enabled) {
    return (
      <div className={classes.empty}>
        {t(
          scope === "current" && !host?.pageId && !host?.spaceId
            ? "Results appear when this block is used in a space."
            : "No matching pages",
        )}
      </div>
    );
  }
  if (query.isPending) return <Skeleton h={28} m="xs" />;
  if (query.isError) {
    return (
      <Group className={classes.empty} gap="sm">
        {t("Could not load matching pages")}
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => void query.refetch()}
        >
          {t("Try again")}
        </Button>
      </Group>
    );
  }
  if (!query.data?.items.length)
    return <div className={classes.empty}>{t("No matching pages")}</div>;
  return (
    <div
      className={classes.list}
      role="list"
      aria-label={options.heading || t("Pages by label")}
    >
      {query.data.items.map((page) => (
        <div key={page.id} className={classes.row} role="listitem">
          <Link
            className={classes.link}
            draggable={false}
            to={buildPageUrl(
              page.space.slug,
              page.slugId,
              page.title ?? undefined,
            )}
          >
            <span className={classes.icon} aria-hidden>
              <PageListIcon icon={page.icon} />
            </span>
            <Stack gap={2} className={styles.result}>
              <span className={classes.title}>
                {page.title || t("Untitled")}
              </span>
              {(options.showSpace || (showLabels && !!page.labels?.length)) && (
                <Group gap={6} className={styles.metadata}>
                  {options.showSpace && (
                    <Text size="xs" component="span" c="dimmed">
                      {page.space.name}
                    </Text>
                  )}
                  {showLabels &&
                    page.labels?.map((name) => (
                      <LabelChip key={name} label={{ name }} />
                    ))}
                </Group>
              )}
            </Stack>
          </Link>
        </div>
      ))}
    </div>
  );
}
