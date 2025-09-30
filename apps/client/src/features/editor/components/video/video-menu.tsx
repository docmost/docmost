import {
  BubbleMenu as BaseBubbleMenu,
  findParentNode,
  posToDOMRect,
  useEditorState,
} from "@tiptap/react";
import React, { useCallback } from "react";
import { sticky } from "tippy.js";
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

export function VideoMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }

      return editor.isActive("video");
    },
    [editor],
  );

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }

      const videoAttrs = ctx.editor.getAttributes("video");

      return {
        isVideo: ctx.editor.isActive("video"),
        isAlignLeft: ctx.editor.isActive("video", { align: "left" }),
        isAlignCenter: ctx.editor.isActive("video", { align: "center" }),
        isAlignRight: ctx.editor.isActive("video", { align: "right" }),
        width: videoAttrs?.width ? parseInt(videoAttrs.width) : null,
      };
    },
  });

  const getReferenceClientRect = useCallback(() => {
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "video";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      return dom.getBoundingClientRect();
    }

    return posToDOMRect(editor.view, selection.from, selection.to);
  }, [editor]);

  const alignVideoLeft = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setVideoAlign("left")
      .run();
  }, [editor]);

  const alignVideoCenter = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setVideoAlign("center")
      .run();
  }, [editor]);

  const alignVideoRight = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setVideoAlign("right")
      .run();
  }, [editor]);

  const onWidthChange = useCallback(
    (value: number) => {
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setVideoWidth(value)
        .run();
    },
    [editor],
  );

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey={`video-menu`}
      updateDelay={0}
      tippyOptions={{
        getReferenceClientRect,
        offset: [0, 8],
        zIndex: 99,
        popperOptions: {
          modifiers: [{ name: "flip", enabled: false }],
        },
        plugins: [sticky],
        sticky: "popper",
      }}
      shouldShow={shouldShow}
    >
      <ActionIcon.Group className="actionIconGroup">
        <Tooltip position="top" label={t("Align left")}>
          <ActionIcon
            onClick={alignVideoLeft}
            size="lg"
            aria-label={t("Align left")}
            variant={editorState?.isAlignLeft ? "light" : "default"}
          >
            <IconLayoutAlignLeft size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Align center")}>
          <ActionIcon
            onClick={alignVideoCenter}
            size="lg"
            aria-label={t("Align center")}
            variant={editorState?.isAlignCenter ? "light" : "default"}
          >
            <IconLayoutAlignCenter size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Align right")}>
          <ActionIcon
            onClick={alignVideoRight}
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

export default VideoMenu;
