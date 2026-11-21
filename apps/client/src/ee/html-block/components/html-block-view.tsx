import { Suspense, useEffect, useRef, useState } from "react";
import { NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Menu,
  Skeleton,
  Text,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowAutofitHeight,
  IconArrowBarToDown,
  IconBrandHtml5,
  IconCheck,
  IconCodeOff,
  IconDots,
  IconPencil,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import clsx from "clsx";
import type { HtmlBlockAttributes, UploadTarget } from "@docmost/editor-ext";
import { lazyWithPrefetch } from "@/lib/lazy-prefetch.ts";
import { RadioMenuItem } from "@/components/ui/radio-menu-item";
import { getEditorUploadTarget } from "@/features/editor/utils/upload-target";
import {
  htmlBlockQueryKey,
  useHtmlBlockContent,
} from "@/ee/html-block/queries/html-block-query";
import { useHtmlBlockScope } from "@/ee/html-block/html-block-scope";
import { useHtmlBlockAccess } from "@/ee/html-block/hooks/use-html-block-access";
import { HtmlBlockFrame } from "@/ee/html-block/components/html-block-frame";
import { HtmlBlockResizeHandle } from "@/ee/html-block/components/html-block-resize-handle";
import { clampHtmlBlockFixedHeight } from "@/ee/html-block/utils/html-block-height";
import { isOwnedByTarget } from "@/ee/html-block/utils/html-block-owner";
import {
  HTML_BLOCK_DEFAULT_FIXED_HEIGHT,
  HTML_BLOCK_LOADING_HEIGHT,
} from "@/ee/html-block/html-block.constants";
import {
  IHtmlBlock,
  IHtmlBlockSaved,
} from "@/ee/html-block/types/html-block.types";
import classes from "./html-block-view.module.css";

const HtmlBlockEditorModal = lazyWithPrefetch(() =>
  import("@/ee/html-block/components/html-block-editor-modal").then(
    (module) => ({ default: module.HtmlBlockEditorModal }),
  ),
);

export function HtmlBlockView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, editor, selected, getPos, updateAttributes, deleteNode } =
    props;
  const htmlBlockId: string | null = node.attrs.htmlBlockId ?? null;
  const fixedHeight =
    typeof node.attrs.height === "number"
      ? clampHtmlBlockFixedHeight(node.attrs.height)
      : null;

  const queryClient = useQueryClient();
  const scope = useHtmlBlockScope();
  const access = useHtmlBlockAccess();
  const editorAllowsEdits = useEditorState({
    editor,
    selector: ({ editor }) =>
      !!editor?.isEditable && getEditorUploadTarget(editor) !== null,
  });
  const canEditHere = access.canEdit && editorAllowsEdits;

  // the server answers for share and public pages; signed-in views follow the workspace switch
  const switchedOff =
    !scope.shareId && !scope.spaceSlug && !scope.preloaded && !access.enabled;
  const { content, error } = useHtmlBlockContent(
    switchedOff ? null : htmlBlockId,
  );

  const contentRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorSession, setEditorSession] = useState<{
    target: UploadTarget;
    previousId: string | null;
  } | null>(null);

  const openEditor = () => {
    const target = getEditorUploadTarget(editor);
    if (!access.canEdit || !editor.isEditable || !target) return;
    const loadedVersion = htmlBlockId
      ? queryClient.getQueryData<IHtmlBlock>(htmlBlockQueryKey(htmlBlockId))
      : undefined;
    // the server refuses a previousId owned elsewhere, such as a pasted block that kept its id
    setEditorSession({
      target,
      previousId: isOwnedByTarget(loadedVersion, target) ? htmlBlockId : null,
    });
  };

  useEffect(() => {
    const storage = editor.storage.htmlBlock;
    if (!storage?.autoOpen || htmlBlockId) return;
    storage.autoOpen = false;
    openEditor();
  }, []);

  const closeEditor = () => {
    setEditorSession(null);
    if (!editor.isDestroyed) {
      editor.commands.focus(undefined, { scrollIntoView: false });
    }
  };

  const updateBlock = (attrs: HtmlBlockAttributes) => {
    if (editor.isDestroyed || !editor.isEditable) return;
    updateAttributes(attrs);
  };

  // the version is already saved, so a switch to read mode while the dialog was open does not drop it
  const handleSaved = (saved: IHtmlBlockSaved) => {
    if (editor.isDestroyed || typeof getPos() !== "number") {
      notifications.show({
        message: t("The block was removed before it could be updated."),
        color: "red",
      });
      return;
    }
    updateAttributes({ htmlBlockId: saved.id });
    selectBlock();
  };

  const selectBlock = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .setNodeSelection(pos)
      .focus(undefined, { scrollIntoView: false })
      .run();
  };

  const fitToContent = () => {
    if (fixedHeight !== null) updateBlock({ height: null });
  };

  const fixHeight = () => {
    if (fixedHeight !== null) return;
    const renderedHeight = contentRef.current?.offsetHeight;
    updateBlock({
      height: clampHtmlBlockFixedHeight(
        renderedHeight || HTML_BLOCK_DEFAULT_FIXED_HEIGHT,
      ),
    });
  };

  const removeBlock = () => {
    if (editor.isEditable) deleteNode();
  };

  const renderBlock = () => {
    if (!htmlBlockId) {
      if (!canEditHere) return null;
      return (
        <Card
          radius="md"
          p="xs"
          withBorder
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          className={clsx(classes.emptyCard, {
            "ProseMirror-selectednode": selected,
          })}
          onClick={openEditor}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <ActionIcon
              variant="transparent"
              color="gray"
              aria-label={t("Add HTML")}
            >
              <IconBrandHtml5 size={18} />
            </ActionIcon>
            <Text component="span" size="lg" c="dimmed">
              {t("Add HTML")}
            </Text>
          </div>
        </Card>
      );
    }

    if (switchedOff || error === "disabled") {
      return (
        <HtmlBlockPlaceholder
          icon={IconCodeOff}
          message={t("HTML blocks are turned off in this workspace.")}
          selected={selected}
        />
      );
    }

    // a PDF prints only the blocks the export could load
    if (scope.preloaded && content === undefined) return null;

    if (error === "unavailable") {
      return (
        <HtmlBlockPlaceholder
          icon={IconBrandHtml5}
          message={t("This HTML block isn't available.")}
          selected={selected}
        />
      );
    }

    if (content === undefined) {
      return (
        <Skeleton
          height={fixedHeight ?? HTML_BLOCK_LOADING_HEIGHT}
          radius="md"
          role="status"
          aria-busy="true"
          aria-label={t("Loading HTML block")}
          className={clsx({ "ProseMirror-selectednode": selected })}
        />
      );
    }

    return (
      <div
        className={classes.frame}
        data-menu-open={menuOpen ? "true" : "false"}
        data-selected={selected ? "true" : "false"}
      >
        {canEditHere && (
          <div
            className={classes.controls}
            contentEditable={false}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Button
              variant="default"
              size="compact-xs"
              leftSection={<IconBrandHtml5 size={14} />}
              onClick={selectBlock}
            >
              {t("HTML")}
            </Button>

            <Tooltip label={t("Edit HTML")}>
              <ActionIcon
                variant="default"
                size="sm"
                onClick={openEditor}
                aria-label={t("Edit HTML")}
              >
                <IconPencil size={14} />
              </ActionIcon>
            </Tooltip>

            <Menu position="bottom-end" withinPortal onChange={setMenuOpen}>
              <Menu.Target>
                <ActionIcon
                  variant="default"
                  size="sm"
                  aria-label={t("HTML block options")}
                >
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconPencil size={14} />}
                  onClick={openEditor}
                >
                  {t("Edit HTML")}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  component={RadioMenuItem}
                  aria-checked={fixedHeight === null}
                  leftSection={<IconArrowAutofitHeight size={14} />}
                  rightSection={
                    fixedHeight === null ? (
                      <IconCheck size={14} aria-hidden />
                    ) : null
                  }
                  onClick={fitToContent}
                >
                  {t("Fit to content")}
                </Menu.Item>
                <Menu.Item
                  component={RadioMenuItem}
                  aria-checked={fixedHeight !== null}
                  leftSection={<IconArrowBarToDown size={14} />}
                  rightSection={
                    fixedHeight !== null ? (
                      <IconCheck size={14} aria-hidden />
                    ) : null
                  }
                  onClick={fixHeight}
                >
                  {t("Fixed height")}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconX size={14} />}
                  onClick={removeBlock}
                >
                  {t("Remove from page")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        )}

        <div
          ref={contentRef}
          className={clsx(classes.content, {
            "ProseMirror-selectednode": selected,
          })}
          style={fixedHeight !== null ? { height: fixedHeight } : undefined}
        >
          <HtmlBlockFrame
            html={content}
            height={fixedHeight === null ? null : "fill"}
            title={t("HTML block")}
          />
          {canEditHere && fixedHeight !== null && (
            <HtmlBlockResizeHandle
              targetRef={contentRef}
              height={fixedHeight}
              onResize={(height) => updateBlock({ height })}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <NodeViewWrapper data-drag-handle>
      {renderBlock()}
      {editorSession && (
        <ErrorBoundary
          fallbackRender={() => null}
          onError={() => setEditorSession(null)}
        >
          <Suspense fallback={null}>
            <HtmlBlockEditorModal
              opened
              onClose={closeEditor}
              initialHtml={htmlBlockId ? (content ?? "") : ""}
              target={editorSession.target}
              previousId={editorSession.previousId}
              onSaved={handleSaved}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </NodeViewWrapper>
  );
}

type HtmlBlockPlaceholderProps = {
  icon: TablerIcon;
  message: string;
  selected: boolean;
};

function HtmlBlockPlaceholder({
  icon: PlaceholderIcon,
  message,
  selected,
}: HtmlBlockPlaceholderProps) {
  return (
    <Card
      radius="md"
      p="xs"
      withBorder
      className={clsx({ "ProseMirror-selectednode": selected })}
    >
      <Group gap={0} justify="center" wrap="nowrap">
        <div className={classes.placeholderIcon}>
          <PlaceholderIcon size={18} aria-hidden />
        </div>
        <Text component="span" size="sm" c="dimmed">
          {message}
        </Text>
      </Group>
    </Card>
  );
}
