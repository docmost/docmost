import {
  BubbleMenu as BaseBubbleMenu,
  findParentNode,
  posToDOMRect,
  useEditorState,
} from "@tiptap/react";
import React, { useCallback } from "react";
import { sticky } from "tippy.js";
import { Node as PMNode } from "prosemirror-model";
import { NodeSelection } from "@tiptap/pm/state";
import { ActionIcon, Tooltip } from "@mantine/core";
import {
  IconEdit,
  IconColumns,
  IconTrashX,
  IconEye,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { NumberInput } from "@mantine/core";


export function TypstMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state || !editor.isEditable) {
        return false;
      }

      const { selection } = state;

      if (
        selection instanceof NodeSelection &&
        selection.node.type.name === "typstBlock"
      ) {
        return true;
      }

      const predicate = (node: PMNode) => node.type.name === "typstBlock";
      const parent = findParentNode(predicate)(selection);

      return Boolean(parent);
    },
    [editor],
  );

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }

      const { selection, tr } = ctx.editor.state;
      const predicate = (node: PMNode) => node.type.name === "typstBlock";

      const target =
        selection instanceof NodeSelection &&
        selection.node.type.name === "typstBlock"
          ? { node: selection.node }
          : findParentNode(predicate)(selection);

      const attrs = target?.node?.attrs ?? {};

      const currentMode = (attrs.editMode as string) || "display";
      const currentScale = (attrs.scale as number) || 100;

      return {
        isDisplay: currentMode === "display",
        isInline: currentMode === "inline",
        isSplit: currentMode === "split",
        currentScale,
        updateId: tr.time,
      };
    },
  });

  const getReferenceClientRect = useCallback(() => {
    const { selection } = editor.state;

    if (
      selection instanceof NodeSelection &&
      selection.node.type.name === "typstBlock"
    ) {
      const dom = editor.view.nodeDOM(selection.from) as HTMLElement | null;

      if (dom) {
        return dom.getBoundingClientRect();
      }
    }

    const predicate = (node: PMNode) => node.type.name === "typstBlock";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent.pos) as HTMLElement | null;
      if (dom) {
        return dom.getBoundingClientRect();
      }
    }

    return posToDOMRect(editor.view, selection.from, selection.to);
  }, [editor]);

  const setDisplayMode = useCallback(() => {
    editor.commands.updateAttributes("typstBlock", { editMode: "display" });
    editor.commands.focus();
  }, [editor]);

  const setInlineMode = useCallback(() => {
    editor.commands.updateAttributes("typstBlock", { editMode: "inline" });
    editor.commands.focus();
  }, [editor]);

  const setSplitMode = useCallback(() => {
    editor.commands.updateAttributes("typstBlock", { editMode: "split" });
    editor.commands.focus();
  }, [editor]);

  const setScale = useCallback((scale: number) => {
    editor.commands.updateAttributes("typstBlock", { scale });
    editor.commands.focus();
  }, [editor]);

  const deleteNode = useCallback(() => {
    const { selection } = editor.state;
    editor
      .chain()
      .focus()
      .setNodeSelection(selection.from)
      .deleteSelection()
      .run();
  }, [editor]);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="typst-menu"
      updateDelay={0}
      tippyOptions={{
        getReferenceClientRect,
        offset: [0, 4],
        zIndex: 99,
        popperOptions: {
          modifiers: [{ name: "flip", enabled: false }],
        },
        plugins: [sticky],
        sticky: "popper",
      }}
      shouldShow={shouldShow}
    >
      <ActionIcon.Group>
        <Tooltip position="top" label={t("Display Mode")}>
          <ActionIcon
            variant={editorState?.isDisplay ? "light" : "default"}
            size="lg"
            aria-label={t("Display Mode")}
            onClick={setDisplayMode}
          >
            <IconEye size={18} />
          </ActionIcon>
        </Tooltip>
        
        <Tooltip position="top" label={t("Edit Mode")}>
          <ActionIcon
            variant={editorState?.isInline ? "light" : "default"}
            size="lg"
            aria-label={t("Edit Mode")}
            onClick={setInlineMode}
          >
            <IconEdit size={18} />
          </ActionIcon>
        </Tooltip>
        
        <Tooltip position="top" label={t("Split View")}>
          <ActionIcon
            variant={editorState?.isSplit ? "light" : "default"}
            size="lg"
            aria-label={t("Split View")}
            onClick={setSplitMode}
          >
            <IconColumns size={18} />
          </ActionIcon>
        </Tooltip>
        
        <Tooltip position="top" label={t("Scale")}>
          <NumberInput
            value={editorState?.currentScale || 100}
            onChange={(value) => setScale(typeof value === 'number' ? value : 100)}
            min={50}
            max={300}
            step={10}
            suffix="%"
            size="sm"
            w={90}
            styles={{
              input: {
                textAlign: 'center',
                height: '36px',
                fontSize: '12px',
              },
            }}
          />
        </Tooltip>
      </ActionIcon.Group>
    </BaseBubbleMenu>
  );
}

export default TypstMenu;