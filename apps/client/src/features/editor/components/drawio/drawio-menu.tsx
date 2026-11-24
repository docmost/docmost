import { NodeBubbleMenu } from "@/features/editor/components/bubble-menu/node-bubble-menu";
import { findParentNode, posToDOMRect, useEditorState } from "@tiptap/react";
import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { Node as PMNode } from "@tiptap/pm/model";
import { isEditorReady } from "@docmost/editor-ext";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types";
import { ActionIcon, Tooltip } from "@mantine/core";
import clsx from "clsx";
import {
  IconLayoutAlignCenter,
  IconLayoutAlignLeft,
  IconLayoutAlignRight,
  IconDownload,
  IconEdit,
  IconTrash,
  IconZoomIn,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { getFileUrl } from "@/lib/config";
import { useAltTextControl } from "../common/use-alt-text-control";
import { lightboxRequestAtom } from "@/features/editor/atoms/editor-atoms";
import { RenameDiagramButton } from "../common/rename-diagram-button";
import { DiagramHistoryButton } from "../common/diagram-history-button";
import { useDiagramEditor } from "../common/use-diagram-editor";
import { DrawioEditor } from "./drawio-editor";
import classes from "../common/toolbar-menu.module.css";

export function DrawioMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const setLightboxRequest = useSetAtom(lightboxRequestAtom);
  const editing = useDiagramEditor(editor, "drawio");

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }

      const drawioAttr = ctx.editor.getAttributes("drawio");
      return {
        isDrawio: ctx.editor.isActive("drawio"),
        isAlignLeft: ctx.editor.isActive("drawio", { align: "left" }),
        isAlignCenter: ctx.editor.isActive("drawio", { align: "center" }),
        isAlignRight: ctx.editor.isActive("drawio", { align: "right" }),
        src: drawioAttr?.src || null,
        attachmentId: drawioAttr?.attachmentId || null,
        alt: drawioAttr?.alt || "",
      };
    },
  });

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }

      return editor.isActive("drawio") && editor.getAttributes("drawio")?.src;
    },
    [editor],
  );

  const getReferencedVirtualElement = useCallback(() => {
    if (!isEditorReady(editor)) return;
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "drawio";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      const domRect = dom.getBoundingClientRect();
      return {
        getBoundingClientRect: () => domRect,
        getClientRects: () => [domRect],
      };
    }

    const domRect = posToDOMRect(editor.view, selection.from, selection.to);
    return {
      getBoundingClientRect: () => domRect,
      getClientRects: () => [domRect],
    };
  }, [editor]);

  const alignLeft = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setDrawioAlign("left")
      .run();
  }, [editor]);

  const alignCenter = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setDrawioAlign("center")
      .run();
  }, [editor]);

  const alignRight = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setDrawioAlign("right")
      .run();
  }, [editor]);

  const handleDownload = useCallback(() => {
    if (!editorState?.src) return;
    const url = getFileUrl(editorState.src);
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.click();
  }, [editorState?.src]);

  const handleDelete = useCallback(() => {
    editor.commands.deleteSelection();
  }, [editor]);

  const {
    button: altTextButton,
    panel: altTextPanel,
    isEditing: isEditingAlt,
  } = useAltTextControl({
    editor,
    nodeName: "drawio",
    currentAlt: editorState?.alt || "",
  });

  return (
    <>
      <NodeBubbleMenu
        editor={editor}
        pluginKey={`drawio-menu`}
        ref={(element) => {
          if (element) element.style.zIndex = "99";
        }}
        updateDelay={0}
        getReferencedVirtualElement={getReferencedVirtualElement}
        options={{
          placement: "top",
          offset: 8,
          flip: false,
        }}
        shouldShow={shouldShow}
      >
        {isEditingAlt ? (
          altTextPanel
        ) : (
          <div className={classes.toolbar}>
            <Tooltip
              position="top"
              label={t("Align left")}
              withinPortal={false}
            >
              <ActionIcon
                onClick={alignLeft}
                size="lg"
                aria-label={t("Align left")}
                variant="subtle"
                className={clsx({ [classes.active]: editorState?.isAlignLeft })}
              >
                <IconLayoutAlignLeft size={18} />
              </ActionIcon>
            </Tooltip>

            <Tooltip
              position="top"
              label={t("Align center")}
              withinPortal={false}
            >
              <ActionIcon
                onClick={alignCenter}
                size="lg"
                aria-label={t("Align center")}
                variant="subtle"
                className={clsx({
                  [classes.active]: editorState?.isAlignCenter,
                })}
              >
                <IconLayoutAlignCenter size={18} />
              </ActionIcon>
            </Tooltip>

            <Tooltip position="top" label={t("Align right")}>
              <ActionIcon
                onClick={alignRight}
                size="lg"
                aria-label={t("Align right")}
                variant="subtle"
                className={clsx({
                  [classes.active]: editorState?.isAlignRight,
                })}
              >
                <IconLayoutAlignRight size={18} />
              </ActionIcon>
            </Tooltip>

            <div className={classes.divider} />

            {altTextButton}

            <div className={classes.divider} />

            <Tooltip position="top" label={t("Expand")} withinPortal={false}>
              <ActionIcon
                onClick={() =>
                  editorState?.src &&
                  setLightboxRequest({
                    src: getFileUrl(editorState.src),
                    type: "image",
                  })
                }
                size="lg"
                aria-label={t("Expand")}
                variant="subtle"
              >
                <IconZoomIn size={18} />
              </ActionIcon>
            </Tooltip>

            <Tooltip position="top" label={t("Edit")} withinPortal={false}>
              <ActionIcon
                onClick={editing.openSelected}
                size="lg"
                aria-label={t("Edit")}
                variant="subtle"
                loading={editing.loading}
              >
                <IconEdit size={18} />
              </ActionIcon>
            </Tooltip>

            {editorState?.attachmentId && (
              <DiagramHistoryButton editor={editor} type="drawio" />
            )}
            {editorState?.attachmentId && (
              <RenameDiagramButton editor={editor} type="drawio" />
            )}

            <Tooltip position="top" label={t("Download")} withinPortal={false}>
              <ActionIcon
                onClick={handleDownload}
                size="lg"
                aria-label={t("Download")}
                variant="subtle"
              >
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>

            <Tooltip position="top" label={t("Delete")} withinPortal={false}>
              <ActionIcon
                onClick={handleDelete}
                size="lg"
                aria-label={t("Delete")}
                variant="subtle"
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </div>
        )}
      </NodeBubbleMenu>

      {editing.session && (
        <DrawioEditor session={editing.session} onClose={editing.close} />
      )}
    </>
  );
}

export default DrawioMenu;
