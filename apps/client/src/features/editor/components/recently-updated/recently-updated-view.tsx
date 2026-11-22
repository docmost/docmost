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
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { formattedDate, shortTimeAgo } from "@/lib/time";
import RecentlyUpdatedSettings from "./recently-updated-settings";
import { EditorSpaceContext } from "./editor-space-context";
import classes from "../subpages/subpages.module.css";
import styles from "./recently-updated.module.css";

type RecentPage = {
  id: string;
  title: string;
  icon?: string;
  isBase?: boolean;
  updatedAt?: string;
  lastEditorName?: string;
  lastEditorAvatarUrl?: string | null;
  slugId: string;
  spaceSlug: string;
};

function FeedRows({ rows }: { rows: RecentPage[] }) {
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
            <Link
              to={buildPageUrl(row.spaceSlug, row.slugId, row.title)}
              className={classes.link}
              draggable={false}
            >
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

function Feed({ options }: { options: RecentlyUpdatedAttributes }) {
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
    queryKey: ["recently-updated", spaceId, viewer?.id, filters],
    queryFn: async () => {
      const response = await api.post<RecentPage[]>("/pages/recently-updated", {
        spaceId,
        ...filters,
      });
      return response.data;
    },
    enabled: !!spaceId && !!viewer?.id,
    staleTime: "static",
    gcTime: 0,
  });

  if (isLoading) return <Skeleton h={32} m="xs" />;
  if (isError)
    return (
      <div className={classes.empty}>{t("Failed to fetch recent pages")}</div>
    );
  return <FeedRows rows={data ?? []} />;
}

export default function RecentlyUpdatedView({
  node,
  editor,
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

  const options: RecentlyUpdatedAttributes = {
    limit: normalizeRecentlyUpdatedLimit(node.attrs.limit),
    hideHeading: node.attrs.hideHeading === true,
    spaces: normalizeRecentlyUpdatedFilterList(node.attrs.spaces),
    labels: normalizeRecentlyUpdatedFilterList(node.attrs.labels),
  };
  const settingsButton = editable && (
    <ActionIcon
      className={`${styles.settings} print-hide`}
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
          options.hideHeading && editable ? styles.headlessEditor : undefined
        }
      >
        {options.hideHeading && settingsButton}
        {recentlyUpdatedFiltersWithinLimits(options) ? (
          <Feed options={options} />
        ) : (
          <div className={classes.empty}>
            {t(
              "Use up to {{maxValues}} values per filter and {{maxLength}} characters per value.",
              RECENTLY_UPDATED_FILTER_LIMITS,
            )}
          </div>
        )}
      </div>
      {editable && settingsOpen && (
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
