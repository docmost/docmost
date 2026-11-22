import { useContext, useState, type ReactNode } from "react";
import { ActionIcon, Skeleton } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import {
  type NodeViewProps,
  NodeViewWrapper,
  useEditorState,
} from "@tiptap/react";
import {
  RECENTLY_UPDATED_FILTER_LIMITS,
  type RecentlyUpdatedAttributes,
  normalizeRecentlyUpdatedFilters,
  normalizeRecentlyUpdatedLimit,
  recentlyUpdatedFiltersWithinLimits,
} from "@docmost/editor-ext";
import { useAtomValue } from "jotai";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api-client";
import { DefaultPageIcon } from "@/components/common/page-list-icon";
import { PageListTime } from "@/components/common/page-list-time";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import RecentlyUpdatedSettings from "./recently-updated-settings";
import { EditorSpaceContext } from "./editor-space-context";
import {
  PageListHeading,
  PageListLayout,
  PageListRefreshButton,
} from "../common/page-list-layout";
import classes from "../common/page-list.module.css";
import styles from "./recently-updated.module.css";

type RecentPage = {
  id: string;
  title: string;
  icon?: string;
  isBase?: boolean;
  updatedAt?: string;
  lastEditorName?: string;
  slugId: string;
  spaceSlug: string;
  spaceName: string;
};

function FeedRows({ rows }: { rows: RecentPage[] }) {
  const { t } = useTranslation();
  if (!rows.length)
    return <div className={classes.empty}>{t("No matching pages")}</div>;

  const showSpace = rows.some((row) => row.spaceSlug !== rows[0].spaceSlug);
  return (
    <div role="list" aria-label={t("Recently updated")}>
      {rows.map((row) => {
        const byline = [
          row.lastEditorName &&
            t("Updated by {{name}}", { name: row.lastEditorName }),
          showSpace && row.spaceName,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div role="listitem" key={row.id}>
            <Link
              to={buildPageUrl(row.spaceSlug, row.slugId, row.title)}
              className={classes.row}
              draggable={false}
            >
              <span className={classes.icon} aria-hidden="true">
                {row.icon || <DefaultPageIcon isBase={row.isBase} />}
              </span>
              <span className={styles.details}>
                <span className={classes.title}>
                  {getPageTitle(row.title, row.isBase, t)}
                </span>
                <span className={styles.metadata}>
                  {byline && (
                    <span className={styles.byline} title={byline}>
                      {byline}
                    </span>
                  )}
                  <PageListTime value={row.updatedAt} className={styles.time} />
                </span>
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function Feed({
  filters,
  heading,
  settings,
}: {
  filters: Omit<RecentlyUpdatedAttributes, "hideHeading">;
  heading: ReactNode;
  settings: ReactNode;
}) {
  const { t } = useTranslation();
  const viewer = useAtomValue(userAtom);
  const editorSpaceId = useContext(EditorSpaceContext);
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(
    editorSpaceId ? undefined : spaceSlug,
  );
  const spaceId = editorSpaceId ?? space?.id;
  const enabled = !!spaceId && !!viewer?.id;
  const { data, isError, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["recently-updated", spaceId, viewer?.id, filters],
    queryFn: async () => {
      const response = await api.post<RecentPage[]>("/pages/recently-updated", {
        spaceId,
        ...filters,
      });
      return response.data;
    },
    enabled,
    staleTime: "static",
    gcTime: 0,
  });

  return (
    <PageListLayout
      heading={heading}
      actions={
        (enabled || settings) && (
          <>
            {enabled && (
              <PageListRefreshButton
                label={t("Refresh recently updated pages")}
                loading={isFetching}
                onClick={() => void refetch()}
              />
            )}
            {settings}
          </>
        )
      }
    >
      {isLoading ? (
        <Skeleton h={32} m="xs" />
      ) : isError ? (
        <div className={classes.empty}>{t("Failed to fetch recent pages")}</div>
      ) : (
        <FeedRows rows={data ?? []} />
      )}
    </PageListLayout>
  );
}

export default function RecentlyUpdatedView({
  node,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const editable = useEditorState({
    editor,
    selector: ({ editor }) => editor.isEditable,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (/^\/(share|docs)(\/|$)/i.test(pathname)) return null;

  const filters = normalizeRecentlyUpdatedFilters(node.attrs);
  const options: RecentlyUpdatedAttributes = {
    limit: normalizeRecentlyUpdatedLimit(node.attrs.limit),
    hideHeading: node.attrs.hideHeading === true,
    ...filters,
  };
  const settingsButton = editable && (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="md"
      aria-label={t("Recently updated settings")}
      title={t("Recently updated settings")}
      onClick={() => setSettingsOpen(true)}
    >
      <IconSettings size={16} />
    </ActionIcon>
  );
  const heading = !options.hideHeading && (
    <PageListHeading editor={editor} getPos={getPos}>
      {t("Recently updated")}
    </PageListHeading>
  );
  return (
    <NodeViewWrapper
      data-type="recently-updated"
      contentEditable={false}
      className={classes.block}
    >
      {recentlyUpdatedFiltersWithinLimits(options) ? (
        <Feed
          filters={{ ...filters, limit: options.limit }}
          heading={heading}
          settings={settingsButton}
        />
      ) : (
        <PageListLayout heading={heading} actions={settingsButton}>
          <div className={classes.empty}>
            {t(
              "Use up to {{maxValues}} values per filter and {{maxLength}} characters per value.",
              RECENTLY_UPDATED_FILTER_LIMITS,
            )}
          </div>
        </PageListLayout>
      )}
      {editable && settingsOpen && (
        <RecentlyUpdatedSettings
          options={options}
          onClose={() => setSettingsOpen(false)}
          onSave={(attributes) => {
            if (editor.isEditable) updateAttributes(attributes);
            setSettingsOpen(false);
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
