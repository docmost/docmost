import { ActionIcon, Collapse } from "@mantine/core";
import { IconChevronRight, IconPointFilled } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import type { SubpagesSortBy } from "@docmost/editor-ext";
import {
  buildPageUrl,
  buildPublicSpaceUrl,
  buildSharedPageUrl,
} from "@/features/page/page.utils";
import { DefaultPageIcon } from "@/components/common/page-list-icon";
import { PageListTime } from "@/components/common/page-list-time";
import listStyles from "../common/page-list.module.css";
import { useSubpages } from "./use-subpages";
import type { SubpageListItem } from "./subpages.utils";
import classes from "./subpages.module.css";

type SubpageItemProps = {
  page: SubpageListItem;
  depth: number;
  sortBy: SubpagesSortBy;
  expandedBranches: Set<() => Promise<unknown>>;
  showUpdatedAt: boolean;
  isPublicSpaceRoute: boolean;
  shareId?: string;
  spaceSlug?: string;
};

function subpageIndent(depth: number) {
  return `min(${8 + depth * 20}px, 30%)`;
}

export default function SubpageItem({
  page,
  depth,
  sortBy,
  expandedBranches,
  showUpdatedAt,
  isPublicSpaceRoute,
  shareId,
  spaceSlug,
}: SubpageItemProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const {
    subpages: children,
    isLoading,
    refetch,
  } = useSubpages(page.id, sortBy, opened && page.hasChildren);
  useEffect(() => {
    if (!refetch) return;
    expandedBranches.add(refetch);
    return () => {
      expandedBranches.delete(refetch);
    };
  }, [expandedBranches, refetch]);

  const title = page.title || t("untitled");

  const pageUrl = shareId
    ? buildSharedPageUrl({
        shareId,
        pageSlugId: page.slugId,
        pageTitle: page.title,
      })
    : isPublicSpaceRoute
      ? buildPublicSpaceUrl({
          spaceSlug,
          pageSlugId: page.slugId,
          pageTitle: page.title,
        })
      : buildPageUrl(spaceSlug, page.slugId, page.title);

  return (
    <div role="listitem">
      <div
        className={classes.treeRow}
        style={{ paddingInlineStart: subpageIndent(depth) }}
      >
        {page.hasChildren ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size={24}
            className={classes.toggle}
            onClick={() => setOpened((value) => !value)}
            aria-label={
              opened
                ? t("Collapse {{name}}", { name: title })
                : t("Expand {{name}}", { name: title })
            }
            aria-expanded={opened}
          >
            <IconChevronRight
              size={16}
              className={clsx(classes.chevron, opened && classes.chevronOpened)}
            />
          </ActionIcon>
        ) : (
          <span className={classes.leaf} aria-hidden>
            <IconPointFilled size={8} />
          </span>
        )}

        <Link
          to={pageUrl}
          className={listStyles.row + " " + classes.link}
          draggable={false}
        >
          <span className={clsx(listStyles.icon, classes.pageIcon)} aria-hidden>
            {page.icon || <DefaultPageIcon isBase={page.isBase} />}
          </span>
          <span className={classes.details}>
            <span className={listStyles.title}>{title}</span>
            {showUpdatedAt && (
              <PageListTime
                value={page.updatedAt}
                className={classes.updatedAt}
              />
            )}
          </span>
        </Link>
      </div>

      {page.hasChildren && (
        <Collapse expanded={opened} keepMounted={false}>
          {isLoading ? (
            <div
              className={classes.loading}
              style={{ paddingInlineStart: subpageIndent(depth + 1) }}
            >
              {t("Loading…")}
            </div>
          ) : (
            <div role="list">
              {children.map((child) => (
                <SubpageItem
                  key={child.id}
                  page={child}
                  depth={depth + 1}
                  sortBy={sortBy}
                  expandedBranches={expandedBranches}
                  showUpdatedAt={showUpdatedAt}
                  isPublicSpaceRoute={isPublicSpaceRoute}
                  shareId={shareId}
                  spaceSlug={spaceSlug}
                />
              ))}
            </div>
          )}
        </Collapse>
      )}
    </div>
  );
}
