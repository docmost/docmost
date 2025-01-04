import {
  BubbleMenu as BaseBubbleMenu,
  findParentNode,
  posToDOMRect,
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

export function ImageMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }

      return editor.isActive("image");
    },
    [editor],
  );

  const getReferenceClientRect = useCallback(() => {
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "image";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      return dom.getBoundingClientRect();
    }

    return posToDOMRect(editor.view, selection.from, selection.to);
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
      pluginKey={`image-menu}`}
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
            onClick={alignImageLeft}
            size="lg"
            aria-label={t("Align left")}
            variant={
              editor.isActive("image", { align: "left" }) ? "light" : "default"
            }
          >
            <IconLayoutAlignLeft size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Align center")}>
          <ActionIcon
            onClick={alignImageCenter}
            size="lg"
            aria-label={t("Align center")}
            variant={
              editor.isActive("image", { align: "center" })
                ? "light"
                : "default"
            }
          >
            <IconLayoutAlignCenter size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip position="top" label={t("Align right")}>
          <ActionIcon
            onClick={alignImageRight}
            size="lg"
            aria-label={t("Align right")}
            variant={
              editor.isActive("image", { align: "right" }) ? "light" : "default"
            }
          >
            <IconLayoutAlignRight size={18} />
          </ActionIcon>
        </Tooltip>
      </ActionIcon.Group>

      {editor.getAttributes("image")?.width && (
        <NodeWidthResize
          onChange={onWidthChange}
          value={parseInt(editor.getAttributes("image").width)}
        />
      )}
    </BaseBubbleMenu>
  );
}

export default ImageMenu;
