import { Button, Group, Skeleton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import {
  ITEMS_BY_LABEL_DEFAULT_LIMIT,
  type ItemsByLabelAttributes,
} from "@docmost/editor-ext";
import { useAtomValue } from "jotai";
import { useContext, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { DefaultPageIcon } from "@/components/common/page-list-icon";
import { PageListTime } from "@/components/common/page-list-time";
import { LabelChip } from "@/features/label/components/label-chip";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import api from "@/lib/api-client";
import { PagesByLabelContext } from "./pages-by-label-context";
import {
  PageListLayout,
  PageListRefreshButton,
} from "../common/page-list-layout";
import classes from "../common/page-list.module.css";
import styles from "./pages-by-label.module.css";

type PageResult = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  isBase: boolean;
  createdAt?: string;
  updatedAt?: string;
  space: { id: string; slug: string; name: string; archivedAt: string | null };
  labels?: string[];
};

export function PagesByLabelResults({
  heading,
  options,
  settings,
}: {
  heading: ReactNode;
  options: ItemsByLabelAttributes;
  settings: ReactNode;
}) {
  const { t } = useTranslation();
  const viewer = useAtomValue(userAtom);
  const host = useContext(PagesByLabelContext);
  const { pageId, spaceId } = host ?? {};
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
    ...(pageId && { pageId }),
    ...(!pageId && spaceId && { contextSpaceId: spaceId }),
    ...(scope !== "current" && { scope }),
    ...(scope === "spaces" && { spaceIds }),
    ...(match !== "any" && { match }),
    ...(excludeLabels.length > 0 && { excludeLabels }),
    ...(sortBy !== "title" && { sortBy }),
    ...(sortDirection !== "asc" && { sortDirection }),
    ...(limit !== ITEMS_BY_LABEL_DEFAULT_LIMIT && { limit }),
    ...(showLabels && { showLabels }),
    ...(pageId && excludeCurrentPage && { excludeCurrentPage }),
  };
  const hasScope =
    scope === "workspace" ||
    (scope === "spaces"
      ? spaceIds.length > 0
      : !!(pageId || spaceId));
  const enabled = !!host && !!viewer && labels.length > 0 && hasScope;
  const query = useQuery({
    // Label mutations already invalidate every query with this prefix.
    queryKey: [
      "label-pages",
      {
        block: "itemsByLabel",
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
  let content: ReactNode;
  if (!enabled) {
    content = (
      <div className={classes.empty}>
        {t(
          scope === "current" && !hasScope
            ? "Results appear when this block is used in a space."
            : "No matching pages",
        )}
      </div>
    );
  } else if (query.isPending) {
    content = <Skeleton h={28} m="xs" />;
  } else if (query.isError) {
    content = (
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
  } else if (!query.data.items.length) {
    content = <div className={classes.empty}>{t("No matching pages")}</div>;
  } else {
    content = <ResultRows pages={query.data.items} options={options} />;
  }
  return (
    <PageListLayout
      heading={heading}
      actions={
        (enabled || settings) && (
          <>
            {enabled && (
              <PageListRefreshButton
                label={t("Refresh matching pages")}
                loading={query.isFetching}
                onClick={() => void query.refetch()}
              />
            )}
            {settings}
          </>
        )
      }
    >
      {content}
    </PageListLayout>
  );
}

function ResultRows({
  pages,
  options,
}: {
  pages: PageResult[];
  options: ItemsByLabelAttributes;
}) {
  const { t } = useTranslation();
  const dateField = options.sortBy === "createdAt" ? "createdAt" : "updatedAt";
  return (
    <div role="list" aria-label={options.heading || t("Pages by label")}>
      {pages.map((page) => (
        <div
          key={page.id}
          role="listitem"
          className={classes.row + " " + styles.resultRow}
        >
          <span className={classes.icon} aria-hidden>
            {page.icon || <DefaultPageIcon isBase={page.isBase} />}
          </span>
          <div className={styles.result}>
            <Link
              className={styles.pageLink}
              draggable={false}
              to={buildPageUrl(
                page.space.slug,
                page.slugId,
                page.title ?? undefined,
              )}
            >
              <span className={classes.title}>
                {getPageTitle(page.title, page.isBase, t)}
              </span>
              <PageListTime
                field={dateField}
                value={page[dateField]}
                className={styles.time}
              />
            </Link>
            {(options.showSpace ||
              (options.showLabels && !!page.labels?.length)) && (
              <div className={styles.metadata}>
                {options.showSpace && <span>{page.space.name}</span>}
                {options.showLabels &&
                  page.labels?.map((name) => (
                    <LabelChip
                      key={name}
                      label={{ name }}
                      asLink
                      spaceId={
                        page.space.archivedAt ? page.space.id : undefined
                      }
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
