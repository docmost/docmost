import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import {
  IconDots,
  IconLinkOff,
  IconPencil,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "react-error-boundary";
import { useTransclusionLookup } from "./transclusion-lookup-context";
import TransclusionContent from "./transclusion-content";
import NoAccessPlaceholder from "./no-access-placeholder";
import NotFoundPlaceholder from "./not-found-placeholder";
import ErrorPlaceholder from "./error-placeholder";
import classes from "./transclusion.module.css";
import SyncBlockReferencesDropdown from "@/features/transclusion/components/sync-block-references-dropdown";
import {
  useReferencesQuery,
  useUnsyncReferenceMutation,
} from "@/features/transclusion/queries/transclusion-query";
import { buildPageUrl } from "@/features/page/page.utils";

export default function TransclusionReferenceView(props: NodeViewProps) {
  const isEditable = props.editor.isEditable;
  const sourcePageId: string | null = props.node.attrs.sourcePageId ?? null;
  const transclusionId: string | null = props.node.attrs.transclusionId ?? null;
  const [openMenus, setOpenMenus] = useState(0);
  const trackOpen = (open: boolean) =>
    setOpenMenus((n) => Math.max(0, n + (open ? 1 : -1)));

  return (
    <NodeViewWrapper
      className={classes.includeWrap}
      data-editable={isEditable ? "true" : "false"}
      data-focused={isEditable && props.selected ? "true" : "false"}
      data-menu-open={openMenus > 0 ? "true" : "false"}
      contentEditable={false}
    >
      <ErrorBoundary
        resetKeys={[sourcePageId, transclusionId]}
        fallback={<ErrorPlaceholder />}
      >
        <TransclusionReferenceBody {...props} trackOpen={trackOpen} />
      </ErrorBoundary>
    </NodeViewWrapper>
  );
}

function TransclusionReferenceBody({
  editor,
  node,
  deleteNode,
  getPos,
  trackOpen,
}: NodeViewProps & { trackOpen: (open: boolean) => void }) {
  const { t } = useTranslation();
  const sourcePageId: string | null = node.attrs.sourcePageId ?? null;
  const transclusionId: string | null = node.attrs.transclusionId ?? null;
  const isEditable = editor.isEditable;

  const { result, refresh } = useTransclusionLookup(
    sourcePageId,
    transclusionId,
  );
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };
  // @ts-ignore - editor.storage.pageId is set by the host editor
  const hostPageId: string | undefined = editor.storage?.pageId;
  const unsyncMutation = useUnsyncReferenceMutation();
  // Cached against the dropdown's identical query so the source link target
  // is ready as soon as the controls fade in on hover, without a second
  // fetch.
  const referencesQuery = useReferencesQuery(
    sourcePageId,
    transclusionId,
    isEditable,
  );
  const sourcePageHref = (() => {
    const source = referencesQuery.data?.source;
    const base = source?.spaceSlug
      ? buildPageUrl(source.spaceSlug, source.slugId, source.title)
      : sourcePageId
        ? `/p/${sourcePageId}`
        : null;
    if (!base) return null;
    return transclusionId ? `${base}#${transclusionId}` : base;
  })();

  const handleUnsync = async () => {
    if (!hostPageId || !sourcePageId || !transclusionId) return;
    try {
      const { content } = await unsyncMutation.mutateAsync({
        referencePageId: hostPageId,
        sourcePageId,
        transclusionId,
      });
      const pos = getPos();
      if (typeof pos !== "number") return;
      const from = pos;
      const to = pos + node.nodeSize;
      editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, content as any)
        .run();
    } catch {
      // mutation surfaces errors via React Query; node stays as-is
    }
  };

  return (
    <>
      {isEditable && (
        <div
          className={classes.includeControls}
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
        >
          {sourcePageId && transclusionId && hostPageId && (
            <SyncBlockReferencesDropdown
              sourcePageId={sourcePageId}
              transclusionId={transclusionId}
              currentPageId={hostPageId}
              mode="reference"
              onOpenChange={trackOpen}
            />
          )}
          <span className={classes.controlsDivider} />
          <Tooltip label={t("Refresh")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={handleRefresh}
              loading={refreshing}
              disabled={!sourcePageId || !transclusionId}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
          {sourcePageHref && (
            <Tooltip label={t("Edit source")}>
              <ActionIcon
                component={Link}
                to={sourcePageHref}
                variant="subtle"
                color="gray"
                size="sm"
                style={{
                  textDecoration: "none",
                  borderBottom: "none",
                }}
              >
                <IconPencil size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          <Menu position="bottom-end" withinPortal onChange={trackOpen}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm">
                <IconDots size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconLinkOff size={14} />}
                onClick={handleUnsync}
                disabled={
                  unsyncMutation.isPending ||
                  !hostPageId ||
                  !sourcePageId ||
                  !transclusionId
                }
              >
                {t("Unsync")}
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => deleteNode()}
              >
                {t("Remove from page")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      )}

      {!sourcePageId || !transclusionId ? (
        <NotFoundPlaceholder />
      ) : !result ? (
        <div style={{ minHeight: 24 }} />
      ) : !("status" in result) ? (
        <TransclusionContent content={result.content} />
      ) : result.status === "no_access" ? (
        <NoAccessPlaceholder />
      ) : (
        <NotFoundPlaceholder />
      )}
    </>
  );
}
