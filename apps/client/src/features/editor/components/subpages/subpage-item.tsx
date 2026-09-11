import { Collapse, Anchor, ActionIcon, Stack } from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconFileDescription,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGetSidebarPagesQuery } from "@/features/page/queries/page-query";
import { buildPageUrl, buildPublicSpaceUrl, buildSharedPageUrl } from "@/features/page/page.utils";
import { useSharedPageSubpages } from "@/features/share/hooks/use-shared-page-subpages";
import { useTranslation } from "react-i18next";
import styles from "../mention/mention.module.css";
import classes from "./subpages.module.css";
import {
  sortSubpages,
  type SubpageListItem,
  type SubpagesSortBy,
} from "./subpages.utils";

interface SubpageItemProps {
  page: SubpageListItem;
  depth: number;
  sortBy: SubpagesSortBy;
  isPublicSpaceRoute: boolean;
  shareId?: string;
  spaceSlug?: string;
}

export default function SubpageItem({
  page,
  depth,
  sortBy,
  shareId,
  spaceSlug,
  isPublicSpaceRoute
}: SubpageItemProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  const sharedSubpages = useSharedPageSubpages(
    shareId && opened ? page.id : undefined
  );
  const { data, isLoading } = useGetSidebarPagesQuery(
    !shareId && opened ? { pageId: page.id } : undefined
  );

  const children = useMemo(() => {
    if (shareId) {
      return sortSubpages(
        sharedSubpages.map((node) => ({
          id: node.value,
          slugId: node.slugId,
          title: node.name,
          icon: node.icon,
          position: node.position,
          hasChildren: node.hasChildren,
        })),
        sortBy
      );
    }

    const pages = data?.pages.flatMap((result) => result.items) || [];
    return sortSubpages(pages, sortBy);
  }, [data, shareId, sharedSubpages, sortBy]);

  const toggleOpened = () => setOpened((value) => !value);

  return (
    <div className={classes.item}>
      <div
        className={classes.row}
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
      >
        {page.hasChildren ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            className={classes.toggle}
            onClick={toggleOpened}
            aria-label={opened ? t("Collapse") : t("Expand")}
          >
            {opened ? (
              <IconChevronDown size={16} />
            ) : (
              <IconChevronRight size={16} />
            )}
          </ActionIcon>
        ) : (
          <span className={classes.togglePlaceholder}></span>
        )}

        <Anchor
          component={Link}
          fw={500}
          to={
            shareId
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
                : buildPageUrl(spaceSlug, page.slugId, page.title)
          }
          underline="never"
          className={styles.pageMentionLink}
          draggable={false}
        >
          {page.icon ? (
            <span className={classes.icon}>{page.icon}</span>
          ) : (
            <ActionIcon
              variant="transparent"
              color="gray"
              component="span"
              size={18}
              style={{ verticalAlign: "text-bottom" }}
            >
              <IconFileDescription size={18} />
            </ActionIcon>
          )}
          <span className={styles.pageMentionText}>
            {page.title || t("untitled")}
          </span>
        </Anchor>
      </div>

      {page.hasChildren && (
        <Collapse expanded={opened}>
          <Stack gap={5}>
            {isLoading ? (
              <div style={{ paddingLeft: `${(depth + 2) * 20 + 4}px` }}>
                ...{t("loading")}
              </div>
            ) : (
              children.map((child) => (
                <SubpageItem
                  key={child.id}
                  page={child}
                  depth={depth + 1}
                  sortBy={sortBy}
                  shareId={shareId}
                  spaceSlug={spaceSlug}
                  isPublicSpaceRoute={isPublicSpaceRoute}
                />
              ))
            )}
          </Stack>
        </Collapse>
      )}
    </div>
  );
}
