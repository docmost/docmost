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
import { useTranslation } from "react-i18next";

export function AudioMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }
      return editor.isActive("audio");
    },
    [editor],
  );

  const getReferenceClientRect = useCallback(() => {
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "audio";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      if (dom) {
        return dom.getBoundingClientRect();
      }
    }
    return posToDOMRect(editor.view, selection.from, selection.to);
  }, [editor]);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey={`audio-menu`}
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
      <></>
    </BaseBubbleMenu>
  );
}

export default AudioMenu;