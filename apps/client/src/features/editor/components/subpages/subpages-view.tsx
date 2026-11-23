import { NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import { ActionIcon, SegmentedControl, Skeleton } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import type { SubpagesAttributes, SubpagesSortBy } from "@docmost/editor-ext";
import { pageEditorBindingAtom } from "@/features/editor/atoms/editor-atoms";
import { publicSpaceTreeDataAtom } from "@/features/public-space/atoms/public-space-atoms.ts";
import { extractPageSlugId } from "@/lib";
import SubpageItem from "./subpage-item";
import { SubpagesSettings } from "./subpages-settings";
import { useSubpages } from "./use-subpages";
import {
  PageListHeading,
  PageListLayout,
  PageListRefreshButton,
} from "../common/page-list-layout";
import listStyles from "../common/page-list.module.css";
import classes from "./subpages.module.css";

export default function SubpagesView(props: NodeViewProps) {
  const { editor, node, getPos, updateAttributes } = props;
  const { spaceSlug, shareId, pageSlug } = useParams();
  const { t } = useTranslation();
  const location = useLocation();
  const headingId = useId();
  const settingsButton = useRef<HTMLButtonElement>(null);
  const expandedBranches = useRef(new Set<() => Promise<unknown>>()).current;
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const isShareRoute = location.pathname.startsWith("/share/");
  const isPublicSpaceRoute = location.pathname.startsWith("/docs/");
  const isPublicView = isShareRoute || isPublicSpaceRoute;
  const binding = useAtomValue(pageEditorBindingAtom);
  const editorEditable = useEditorState({
    editor,
    selector: (ctx) => ctx.editor.isEditable,
  });
  const editable =
    !isPublicView &&
    (binding?.editor === editor ? binding.editable : editorEditable);
  useEffect(() => {
    if (!editable) setSettingsOpened(false);
  }, [editable]);

  const publicSpaceTreeData = useAtomValue(publicSpaceTreeDataAtom);

  // @ts-ignore
  const storagePageId = editor.storage.pageId;
  const routePageId = extractPageSlugId(pageSlug);
  let currentPageId = storagePageId;

  if (isShareRoute) {
    currentPageId = routePageId;
  }

  // Public docs must resolve the page from the route, not editor storage:
  // storage.pageId is set after this view's first render and is not reactive,
  // which froze the list at "No subpages" until something re-rendered it. The
  // space home renders at the bare URL, so it falls back to the first root.
  if (isPublicSpaceRoute) {
    currentPageId = routePageId ?? publicSpaceTreeData?.[0]?.slugId;
  }

  const {
    sortBy = "default",
    heading,
    hideHeading = false,
  } = node.attrs as SubpagesAttributes;
  const { subpages, isLoading, error, refetch } = useSubpages(
    currentPageId,
    sortBy,
  );
  const defaultHeading = t("Subpages");
  const customHeading = heading?.trim() || "";
  const listName = customHeading || defaultHeading;

  function closeSettings() {
    setSettingsOpened(false);
    requestAnimationFrame(() =>
      settingsButton.current?.focus({ preventScroll: true }),
    );
  }

  async function refreshSubpages() {
    if (!refetch) return;
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        ...Array.from(expandedBranches, (reload) => reload()),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <NodeViewWrapper
      data-drag-handle
      data-type="subpages"
      contentEditable={false}
      className={listStyles.block + " " + classes.block}
    >
      <PageListLayout
        heading={
          !hideHeading && (
            <PageListHeading editor={editor} getPos={getPos} id={headingId}>
              {listName}
            </PageListHeading>
          )
        }
        actions={
          (refetch || editable) && (
            <>
              {editable && subpages.length > 1 && (
                <SegmentedControl<SubpagesSortBy>
                  size="xs"
                  className={classes.sortControl}
                  value={sortBy}
                  onChange={(value) => {
                    if (editor.isEditable) updateAttributes({ sortBy: value });
                  }}
                  data={[
                    { label: t("Manual"), value: "default" },
                    { label: t("A–Z"), value: "title-asc" },
                    { label: t("Recent"), value: "recent" },
                  ]}
                  aria-label={t("Sort subpages")}
                />
              )}
              {refetch && (
                <PageListRefreshButton
                  label={t("Refresh subpages")}
                  loading={isLoading || refreshing}
                  onClick={refreshSubpages}
                />
              )}
              {editable && (
                <ActionIcon
                  ref={settingsButton}
                  variant="subtle"
                  color="gray"
                  size="md"
                  aria-label={t("Subpages settings")}
                  title={t("Subpages settings")}
                  onClick={() => setSettingsOpened(true)}
                >
                  <IconSettings size={16} />
                </ActionIcon>
              )}
            </>
          )
        }
      >
        {isLoading ? (
          <Skeleton h={32} m="xs" />
        ) : subpages.length > 0 ? (
          <div
            role="list"
            aria-labelledby={hideHeading ? undefined : headingId}
            aria-label={hideHeading ? listName : undefined}
          >
            {subpages.map((page) => (
              <SubpageItem
                key={page.id}
                page={page}
                depth={0}
                sortBy={sortBy}
                expandedBranches={expandedBranches}
                showUpdatedAt={!isPublicView}
                isPublicSpaceRoute={isPublicSpaceRoute}
                shareId={shareId}
                spaceSlug={spaceSlug}
              />
            ))}
          </div>
        ) : (
          <div className={listStyles.empty}>
            {error ? t("Failed to load subpages") : t("No subpages")}
          </div>
        )}
      </PageListLayout>
      {editable && settingsOpened && (
        <SubpagesSettings
          heading={customHeading}
          hideHeading={hideHeading}
          defaultHeading={defaultHeading}
          onClose={closeSettings}
          onSave={(changes) => {
            if (editor.isEditable && Object.keys(changes).length) {
              updateAttributes(changes);
            }
            closeSettings();
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
