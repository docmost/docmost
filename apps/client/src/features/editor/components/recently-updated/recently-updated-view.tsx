import { useContext, useState } from "react";
import { ActionIcon, Modal, Skeleton, Text } from "@mantine/core";
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
  normalizeRecentlyUpdatedFilterList,
  normalizeRecentlyUpdatedLimit,
  recentlyUpdatedFiltersWithinLimits,
} from "@docmost/editor-ext";
import { useAtomValue } from "jotai";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api-client";
import { PageListIcon } from "@/components/common/page-list-icon";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { usePublicSpaceTreeQuery } from "@/features/public-space/queries/public-space-query";
import { useGetSharedPageTreeQuery } from "@/features/share/queries/share-query";
import { useDocsSurface } from "@/features/public-space/components/docs/docs-surface-context";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { formattedDate, shortTimeAgo } from "@/lib/time";
import { publicRecentlyUpdatedPages } from "./public-recently-updated";
import RecentlyUpdatedSettings from "./recently-updated-settings";
import { EditorSpaceContext } from "./editor-space-context";
import classes from "../subpages/subpages.module.css";
import styles from "./recently-updated.module.css";

const FEED_REFRESH_INTERVAL = 30_000;

type FeedRow = {
  id: string;
  title: string;
  icon?: string;
  isBase?: boolean;
  updatedAt?: string;
  lastEditorName?: string;
  lastEditorAvatarUrl?: string | null;
  url: string;
};

type RecentPage = Omit<FeedRow, "url"> & { slugId: string; spaceSlug: string };

function FeedRows({ rows }: { rows: FeedRow[] }) {
  const { t } = useTranslation();
  if (!rows.length)
    return <div className={classes.empty}>{t("No matching pages")}</div>;

  return (
    <div role="list" className={classes.list}>
      {rows.map((row) => {
        const date = row.updatedAt && new Date(row.updatedAt);
        const timestamp = date && (
          <time
            className={row.lastEditorName ? styles.time : classes.updatedAt}
            dateTime={row.updatedAt}
            title={formattedDate(date)}
          >
            {shortTimeAgo(date)}
          </time>
        );
        return (
          <div role="listitem" key={row.id} className={classes.row}>
            <Link to={row.url} className={classes.link} draggable={false}>
              <span className={classes.icon} aria-hidden>
                <PageListIcon icon={row.icon} isBase={row.isBase} />
              </span>
              <span className={classes.title}>
                {getPageTitle(row.title, row.isBase, t)}
              </span>
              {row.lastEditorName ? (
                <span className={styles.byline}>
                  <CustomAvatar
                    component="span"
                    name={row.lastEditorName}
                    avatarUrl={row.lastEditorAvatarUrl}
                    size={28}
                    radius="xl"
                    aria-hidden="true"
                  />
                  <span className={styles.bylineText}>
                    <Text
                      component="span"
                      size="sm"
                      truncate
                      title={row.lastEditorName}
                    >
                      {row.lastEditorName}
                    </Text>
                    {timestamp}
                  </span>
                </span>
              ) : (
                timestamp
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function PublicFeed({ options }: { options: RecentlyUpdatedAttributes }) {
  const surface = useDocsSurface();
  const { spaceSlug, shareId } = useParams();
  const docs = usePublicSpaceTreeQuery(spaceSlug, FEED_REFRESH_INTERVAL);
  const share = useGetSharedPageTreeQuery(shareId, FEED_REFRESH_INTERVAL);
  if (docs.isError || share.isError) return <FeedRows rows={[]} />;
  return <FeedRows rows={publicRecentlyUpdatedPages(surface, options)} />;
}

function PrivateFeed({ options }: { options: RecentlyUpdatedAttributes }) {
  const { t } = useTranslation();
  const viewer = useAtomValue(userAtom);
  const editorSpaceId = useContext(EditorSpaceContext);
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(
    editorSpaceId ? undefined : spaceSlug,
  );
  const spaceId = editorSpaceId ?? space?.id;
  const { spaces, labels, limit } = options;
  const filters = { spaces, labels, limit };
  const { data, isError, isLoading } = useQuery({
    queryKey: [
      "recent-changes",
      spaceId,
      "recently-updated",
      viewer?.id,
      filters,
    ],
    queryFn: async () => {
      const response = await api.post<RecentPage[]>("/pages/recently-updated", {
        spaceId,
        ...filters,
      });
      return response.data;
    },
    enabled: !!spaceId && !!viewer?.id,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Edits in other selected spaces need not reach the current space's socket room.
    refetchInterval: FEED_REFRESH_INTERVAL,
  });

  if (isLoading) return <Skeleton h={32} m="xs" />;
  if (isError)
    return (
      <div className={classes.empty}>{t("Failed to fetch recent pages")}</div>
    );
  const rows = (data ?? []).map((page) => ({
    ...page,
    url: buildPageUrl(page.spaceSlug, page.slugId, page.title),
  }));
  return <FeedRows rows={rows} />;
}

export default function RecentlyUpdatedView({
  node,
  editor,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isPublic = /^\/(share|docs)(\/|$)/i.test(pathname);
  const editable = useEditorState({
    editor,
    selector: ({ editor }) => editor.isEditable,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const options: RecentlyUpdatedAttributes = {
    limit: normalizeRecentlyUpdatedLimit(node.attrs.limit),
    hideHeading: node.attrs.hideHeading === true,
    spaces: normalizeRecentlyUpdatedFilterList(node.attrs.spaces),
    labels: normalizeRecentlyUpdatedFilterList(node.attrs.labels),
  };
  const canEdit = editable && !isPublic;
  const settingsButton = canEdit && (
    <ActionIcon
      className={styles.settings}
      variant="subtle"
      color="gray"
      size="sm"
      aria-label={t("Recently updated settings")}
      onClick={() => setSettingsOpen(true)}
    >
      <IconSettings size={16} />
    </ActionIcon>
  );
  return (
    <NodeViewWrapper
      data-type="recently-updated"
      contentEditable={false}
      className={classes.card}
    >
      {!options.hideHeading && (
        <div className={classes.header}>
          <span className={classes.heading}>{t("Recently updated")}</span>
          {settingsButton}
        </div>
      )}
      <div
        className={
          options.hideHeading && canEdit ? styles.headlessEditor : undefined
        }
      >
        {options.hideHeading && settingsButton}
        {isPublic ? (
          <PublicFeed options={options} />
        ) : recentlyUpdatedFiltersWithinLimits(options) ? (
          <PrivateFeed options={options} />
        ) : (
          <div className={classes.empty}>
            {t(
              "Use up to {{maxValues}} values per filter and {{maxLength}} characters per value.",
              RECENTLY_UPDATED_FILTER_LIMITS,
            )}
          </div>
        )}
      </div>
      {canEdit && settingsOpen && (
        <Modal
          opened
          onClose={() => setSettingsOpen(false)}
          title={t("Recently updated settings")}
        >
          <RecentlyUpdatedSettings
            options={options}
            onSave={(attributes) => {
              if (editor.isEditable) updateAttributes(attributes);
              setSettingsOpen(false);
            }}
          />
        </Modal>
      )}
    </NodeViewWrapper>
  );
}
