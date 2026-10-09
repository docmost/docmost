import { ActionIcon, Collapse } from "@mantine/core";
import { IconChevronRight, IconFileDescription } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import type { SubpagesSortBy } from "@docmost/editor-ext";
import {
  buildPageUrl,
  buildPublicSpaceUrl,
  buildSharedPageUrl,
} from "@/features/page/page.utils";
import { formattedDate, shortTimeAgo } from "@/lib/time";
import { useSubpages } from "./use-subpages";
import type { SubpageListItem } from "./subpages.utils";
import classes from "./subpages.module.css";

type SubpageItemProps = {
  page: SubpageListItem;
  depth: number;
  sortBy: SubpagesSortBy;
  showUpdatedAt: boolean;
  isPublicSpaceRoute: boolean;
  shareId?: string;
  spaceSlug?: string;
};

export default function SubpageItem({
  page,
  depth,
  sortBy,
  showUpdatedAt,
  isPublicSpaceRoute,
  shareId,
  spaceSlug,
}: SubpageItemProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const { subpages: children, isLoading } = useSubpages(
    page.id,
    sortBy,
    opened,
  );

  const title = page.title || t("untitled");
  const updatedAt =
    showUpdatedAt && page.updatedAt ? new Date(page.updatedAt) : null;

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
        className={classes.row}
        style={{ paddingInlineStart: 8 + depth * 24 }}
      >
        {page.hasChildren ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size={22}
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
          <span className={classes.togglePlaceholder} />
        )}

        <Link to={pageUrl} className={classes.link} draggable={false}>
          <span className={classes.icon} aria-hidden>
            {page.icon || <IconFileDescription size={18} stroke={1.5} />}
          </span>
          <span className={classes.title}>{title}</span>
          {updatedAt && (
            <time
              className={classes.updatedAt}
              dateTime={updatedAt.toISOString()}
              title={formattedDate(updatedAt)}
            >
              {shortTimeAgo(updatedAt)}
            </time>
          )}
        </Link>
      </div>

      {page.hasChildren && (
        <Collapse expanded={opened} keepMounted={false}>
          {isLoading ? (
            <div
              className={classes.loading}
              style={{ paddingInlineStart: 8 + (depth + 1) * 24 }}
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
