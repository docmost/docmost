import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { findParentNode, posToDOMRect, useEditorState } from "@tiptap/react";
import React, { useCallback } from "react";
import { Node as PMNode } from "prosemirror-model";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { ActionIcon, Tooltip } from "@mantine/core";
import {
  IconLayoutAlignCenter,
  IconLayoutAlignLeft,
  IconLayoutAlignRight,
} from "@tabler/icons-react";
import { NodeWidthResize } from "@/features/editor/components/common/node-width-resize.tsx";
import { useTranslation } from "react-i18next";

export function ImageMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();

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
        width: imageAttrs?.width ? parseInt(imageAttrs.width) : null,
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

  const onWidthChange = useCallback(
    (value: number) => {
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setImageWidth(value)
        .run();
    },
    [editor],
  );

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
      <ActionIcon.Group className="actionIconGroup">
        <Tooltip position="top" label={t("Align left")}>
          <ActionIcon
            onClick={alignImageLeft}
            size="lg"
            aria-label={t("Align left")}
            variant={editorState?.isAlignLeft ? "light" : "default"}
          >
            <IconLayoutAlignLeft size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Align center")}>
          <ActionIcon
            onClick={alignImageCenter}
            size="lg"
            aria-label={t("Align center")}
            variant={editorState?.isAlignCenter ? "light" : "default"}
          >
            <IconLayoutAlignCenter size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Align right")}>
          <ActionIcon
            onClick={alignImageRight}
            size="lg"
            aria-label={t("Align right")}
            variant={editorState?.isAlignRight ? "light" : "default"}
          >
            <IconLayoutAlignRight size={18} />
          </ActionIcon>
        </Tooltip>
      </ActionIcon.Group>

      {editorState?.width && (
        <NodeWidthResize onChange={onWidthChange} value={editorState.width} />
      )}
    </BaseBubbleMenu>
  );
}

export default ImageMenu;
