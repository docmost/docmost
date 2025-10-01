import {
  BubbleMenu as BaseBubbleMenu,
  posToDOMRect,
  useEditorState,
} from "@tiptap/react";
import { findParentNode } from "@tiptap/core";  
import React, { useCallback, useEffect, useRef, useState } from "react";
import { sticky } from "tippy.js";
import { Node as PMNode } from "prosemirror-model";
import { NodeSelection } from "@tiptap/pm/state";
import { ActionIcon, NumberInput, TextInput, Tooltip } from "@mantine/core";
import {
  IconColumns,
  IconEdit,
  IconEye,
  IconTrashX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";

const normalizeHeightValue = (
  value: string | number | null | undefined
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return `${value}px`;
  }

  const trimmed = value.trim();

  if (!trimmed.length) {
    return null;
  }

  if (trimmed.toLowerCase() === "auto") {
    return null;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const numeric = Number.parseFloat(trimmed);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return `${numeric}px`;
    }
  }

  return trimmed;
};

const formatHeightForInput = (
  value: string | number | null | undefined
): string => {
  const normalized = normalizeHeightValue(value);
  return normalized ?? "";
};

export function TypstMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const [heightValue, setHeightValue] = useState<string>("");
  const [lastSyncedHeight, setLastSyncedHeight] = useState<string>("");
  const [isHeightDirty, setIsHeightDirty] = useState(false);
  const wasMenuActiveRef = useRef(false);

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
    [editor]
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

      if (!target) {
        return null;
      }

      const attrs = target?.node?.attrs ?? {};

      const currentMode = (attrs.editMode as string) || "display";
      const currentScale = (attrs.scale as number) || 100;
      const currentHeight = attrs.height ?? null;

      return {
        isDisplay: currentMode === "display",
        isInline: currentMode === "inline",
        isSplit: currentMode === "split",
        currentScale,
        currentHeight,
        updateId: tr.time,
      };
    },
  });

  const isMenuActive = Boolean(editorState);

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

  const setScale = useCallback(
    (scale: number) => {
      editor.commands.updateAttributes("typstBlock", { scale });
    },
    [editor]
  );

  useEffect(() => {
    const formatted = formatHeightForInput(editorState?.currentHeight ?? null);
    setLastSyncedHeight(formatted);

    if (!isHeightDirty) {
      setHeightValue(formatted);
    }
  }, [editorState?.currentHeight, editorState?.updateId, isHeightDirty]);

  const commitHeight = useCallback(
    (options?: { skipFocus?: boolean }) => {
      const nextHeight = normalizeHeightValue(heightValue);
      const nextFormatted = nextHeight ?? "";

      if (nextFormatted === lastSyncedHeight) {
        if (heightValue !== nextFormatted) {
          setHeightValue(nextFormatted);
        }
        setIsHeightDirty(false);
        return;
      }

      editor.commands.updateAttributes("typstBlock", { height: nextHeight });

      if (!options?.skipFocus) {
        editor.commands.focus();
      }

      setLastSyncedHeight(nextFormatted);
      setHeightValue(nextFormatted);
      setIsHeightDirty(false);
    },
    [editor, heightValue, lastSyncedHeight]
  );

  useEffect(() => {
    if (wasMenuActiveRef.current && !isMenuActive) {
      commitHeight({ skipFocus: true });
    }

    wasMenuActiveRef.current = isMenuActive;
  }, [commitHeight, isMenuActive]);

  const handleHeightFocus = useCallback(() => {
    setIsHeightDirty(true);
  }, []);

  const handleHeightChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setHeightValue(event.currentTarget.value);
      setIsHeightDirty(true);
    },
    []
  );

  const handleHeightBlur = useCallback(() => {
    commitHeight({ skipFocus: true });
  }, [commitHeight]);

  const handleHeightKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitHeight({ skipFocus: true });
      }
    },
    [commitHeight]
  );

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

        <Tooltip position="top" label={t("Height")}>
          <TextInput
            value={heightValue}
            onFocus={handleHeightFocus}
            onChange={handleHeightChange}
            onBlur={handleHeightBlur}
            onKeyDown={handleHeightKeyDown}
            size="sm"
            w={120}
            placeholder={t("Auto")}
            spellCheck={false}
            autoComplete="off"
            styles={{
              input: {
                textAlign: "center",
                height: "36px",
                fontSize: "12px",
              },
            }}
          />
        </Tooltip>

        <Tooltip position="top" label={t("Scale")}>
          <NumberInput
            value={editorState?.currentScale || 100}
            onChange={(value) =>
              setScale(typeof value === "number" ? Math.round(value) : 100)
            }
            min={50}
            max={300}
            step={10}
            suffix="%"
            size="sm"
            w={90}
            styles={{
              input: {
                textAlign: "center",
                height: "36px",
                fontSize: "12px",
              },
            }}
          />
        </Tooltip>
      </ActionIcon.Group>
    </BaseBubbleMenu>
  );
}

export default TypstMenu;
