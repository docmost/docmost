import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { findParentNode, posToDOMRect, useEditorState } from "@tiptap/react";
import React, { useCallback, useRef } from "react";
import { Node as PMNode } from "prosemirror-model";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { ActionIcon, Tooltip } from "@mantine/core";
import clsx from "clsx";
import {
  IconLayoutAlignCenter,
  IconLayoutAlignLeft,
  IconLayoutAlignRight,
  IconDownload,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { getFileUrl } from "@/lib/config.ts";
import { uploadImageAction } from "@/features/editor/components/image/upload-image-action.tsx";
import classes from "../common/toolbar-menu.module.css";

export function ImageMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }

      const imageAttrs = ctx.editor.getAttributes("image");

      return {
        isImage: ctx.editor.isActive("image"),
        isAlignLeft: ctx.editor.isActive("image", { align: "left" }),
        isAlignCenter: ctx.editor.isActive("image", { align: "center" }),
        isAlignRight: ctx.editor.isActive("image", { align: "right" }),
        src: imageAttrs?.src || null,
      };
    },
  });

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }

      return editor.isActive("image") && editor.getAttributes("image").src;
    },
    [editor],
  );

  const getReferencedVirtualElement = useCallback(() => {
    if (!editor) return;
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "image";
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

  const alignImageLeft = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setImageAlign("left")
      .run();
  }, [editor]);

  const alignImageCenter = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setImageAlign("center")
      .run();
  }, [editor]);

  const alignImageRight = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setImageAlign("right")
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

  const handleReplace = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // @ts-ignore
      const pageId = editor.storage?.pageId;
      if (pageId) {
        const pos = editor.state.selection.from;
        uploadImageAction(file, editor, pos, pageId);
      }
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [editor],
  );

  const handleDelete = useCallback(() => {
    editor.commands.deleteSelection();
  }, [editor]);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey={`image-menu`}
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{
        placement: "top",
        offset: 8,
        flip: false,
      }}
      shouldShow={shouldShow}
    >
      <div className={classes.toolbar}>
        <Tooltip position="top" label={t("Align left")}>
          <ActionIcon
            onClick={alignImageLeft}
            size="lg"
            aria-label={t("Align left")}
            variant="subtle"
            className={clsx({ [classes.active]: editorState?.isAlignLeft })}
          >
            <IconLayoutAlignLeft size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Align center")}>
          <ActionIcon
            onClick={alignImageCenter}
            size="lg"
            aria-label={t("Align center")}
            variant="subtle"
            className={clsx({ [classes.active]: editorState?.isAlignCenter })}
          >
            <IconLayoutAlignCenter size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Align right")}>
          <ActionIcon
            onClick={alignImageRight}
            size="lg"
            aria-label={t("Align right")}
            variant="subtle"
            className={clsx({ [classes.active]: editorState?.isAlignRight })}
          >
            <IconLayoutAlignRight size={18} />
          </ActionIcon>
        </Tooltip>

        <div className={classes.divider} />

        <Tooltip position="top" label={t("Download")}>
          <ActionIcon
            onClick={handleDownload}
            size="lg"
            aria-label={t("Download")}
            variant="subtle"
          >
            <IconDownload size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Replace image")}>
          <ActionIcon
            onClick={handleReplace}
            size="lg"
            aria-label={t("Replace image")}
            variant="subtle"
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Delete")}>
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </BaseBubbleMenu>
  );
}

export default ImageMenu;
