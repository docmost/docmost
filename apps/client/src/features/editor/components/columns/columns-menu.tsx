import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { findParentNode, posToDOMRect, useEditorState } from "@tiptap/react";
import React, { useCallback, useRef, useState } from "react";
import { DOMSerializer, Node as PMNode } from "@tiptap/pm/model";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { ActionIcon, Tooltip, Popover, Button } from "@mantine/core";
import clsx from "clsx";
import {
  IconChevronDown,
  IconCheck,
  IconColumns2,
  IconColumns3,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconLayoutAlignCenter,
  IconCopy,
  IconTrash,
} from "@tabler/icons-react";
import { isTextSelected } from "@docmost/editor-ext";
import type { WidthMode, ColumnsLayout } from "@docmost/editor-ext";
import { useTranslation } from "react-i18next";
import classes from "../common/toolbar-menu.module.css";

type LayoutPreset = {
  layout: ColumnsLayout;
  label: string;
  icon: React.ElementType;
};

const twoColumnPresets: LayoutPreset[] = [
  { layout: "two_equal", label: "Equal columns", icon: IconColumns2 },
  {
    layout: "two_left_sidebar",
    label: "Left sidebar",
    icon: IconLayoutSidebar,
  },
  {
    layout: "two_right_sidebar",
    label: "Right sidebar",
    icon: IconLayoutSidebarRight,
  },
];

const threeColumnPresets: LayoutPreset[] = [
  { layout: "three_equal", label: "Equal columns", icon: IconColumns3 },
  {
    layout: "three_with_sidebars",
    label: "Wide center",
    icon: IconLayoutAlignCenter,
  },
  {
    layout: "three_left_wide",
    label: "Left wide",
    icon: IconLayoutSidebarRight,
  },
  { layout: "three_right_wide", label: "Right wide", icon: IconLayoutSidebar },
];

function getPresetsForCount(count: number): LayoutPreset[] {
  if (count === 2) return twoColumnPresets;
  if (count === 3) return threeColumnPresets;
  return [];
}

export function ColumnsMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const [isCountOpen, setIsCountOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const nodesWithMenus = [
    "callout",
    "image",
    "video",
    "drawio",
    "excalidraw",
    "table",
  ];

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) return false;
      if (!editor.isActive("columns")) return false;
      if (isTextSelected(editor)) return false;
      if (nodesWithMenus.some((name) => editor.isActive(name))) return false;

      const parent = findParentNode(
        (node: PMNode) => node.type.name === "columns",
      )(state.selection);
      if (!parent) return false;

      const dom = editor.view.nodeDOM(parent.pos) as HTMLElement;
      if (!dom) return false;

      const rect = dom.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    },
    [editor],
  );

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) return null;

      const { selection } = ctx.editor.state;
      const parent = findParentNode(
        (node: PMNode) => node.type.name === "columns",
      )(selection);

      return {
        columnCount: parent?.node.childCount || 2,
        layout: (parent?.node.attrs.layout as ColumnsLayout) || "two_equal",
        isNormal: ctx.editor.isActive("columns", { widthMode: "normal" }),
        isWide: ctx.editor.isActive("columns", { widthMode: "wide" }),
      };
    },
  });

  const getReferencedVirtualElement = useCallback(() => {
    if (!editor) return;
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "columns";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      const domRect = dom.getBoundingClientRect();

      // Columns entirely out of viewport — return real rect so menu goes off-screen
      if (domRect.bottom <= 0 || domRect.top >= window.innerHeight) {
        return {
          getBoundingClientRect: () => domRect,
          getClientRects: () => [domRect],
        };
      }

      // Clamp bottom so menu stays within viewport when columns extend below it
      // 55px = 15px offset + ~40px menu height
      const maxBottom = window.innerHeight - 55;
      if (domRect.bottom > maxBottom) {
        const clamped = new DOMRect(
          domRect.x,
          domRect.y,
          domRect.width,
          maxBottom - domRect.y,
        );
        return {
          getBoundingClientRect: () => clamped,
          getClientRects: () => [clamped],
        };
      }

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

  const setColumnCount = useCallback(
    (count: number) => {
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setColumnCount(count)
        .run();
      setIsCountOpen(false);
    },
    [editor],
  );

  const setLayout = useCallback(
    (layout: ColumnsLayout) => {
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setColumnsLayout(layout)
        .run();
    },
    [editor],
  );

  const handleCopy = useCallback(() => {
    const { state } = editor;
    const parent = findParentNode(
      (node: PMNode) => node.type.name === "columns",
    )(state.selection);
    if (!parent) return;

    const serializer = DOMSerializer.fromSchema(state.schema);
    const dom = serializer.serializeNode(parent.node);
    const wrapper = document.createElement("div");
    wrapper.appendChild(dom);

    const onSuccess = () => {
      clearTimeout(copyTimerRef.current);
      setCopied(true);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    };

    if (navigator.clipboard?.write) {
      navigator.clipboard
        .write([
          new ClipboardItem({
            "text/html": new Blob([wrapper.innerHTML], { type: "text/html" }),
            "text/plain": new Blob([parent.node.textContent], {
              type: "text/plain",
            }),
          }),
        ])
        .then(onSuccess)
        .catch(execCommandFallback);
    } else {
      execCommandFallback();
    }

    function execCommandFallback() {
      wrapper.style.position = "fixed";
      wrapper.style.left = "-9999px";
      document.body.appendChild(wrapper);
      const range = document.createRange();
      range.selectNodeContents(wrapper);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand("copy");
      sel?.removeAllRanges();
      document.body.removeChild(wrapper);
      editor.view.focus();
      onSuccess();
    }
  }, [editor]);

  const handleDelete = useCallback(() => {
    const parent = findParentNode(
      (node: PMNode) => node.type.name === "columns",
    )(editor.state.selection);
    if (!parent) return;
    editor.chain().focus().setNodeSelection(parent.pos).deleteSelection().run();
  }, [editor]);

  const columnCount = editorState?.columnCount || 2;
  const currentLayout = editorState?.layout || "two_equal";
  const presets = getPresetsForCount(columnCount);

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey="columns-menu"
      updateDelay={0}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{
        placement: "bottom",
        offset: {
          mainAxis: 5,
        },
        flip: false,
      }}
      shouldShow={shouldShow}
    >
      <div className={classes.toolbar}>
        <Popover opened={isCountOpen} onChange={setIsCountOpen} withArrow>
          <Popover.Target>
            <Button
              variant="subtle"
              color="dark"
              size="compact-sm"
              rightSection={<IconChevronDown size={12} />}
              onClick={() => setIsCountOpen(!isCountOpen)}
              aria-label={t("Column count")}
            >
              {t("{{count}} Columns", { count: columnCount })}
            </Button>
          </Popover.Target>
          <Popover.Dropdown p={4}>
            <Button.Group orientation="vertical">
              {[2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  variant={n === columnCount ? "light" : "subtle"}
                  color={n === columnCount ? "blue" : "dark"}
                  justify="space-between"
                  fullWidth
                  rightSection={
                    n === columnCount ? <IconCheck size={14} /> : null
                  }
                  onClick={() => setColumnCount(n)}
                  size="xs"
                >
                  {t("{{count}} Columns", { count: n })}
                </Button>
              ))}
            </Button.Group>
          </Popover.Dropdown>
        </Popover>

        {presets.length > 0 && <div className={classes.divider} />}

        {presets.map((preset) => (
          <Tooltip key={preset.layout} position="top" label={t(preset.label)}>
            <ActionIcon
              onClick={() => setLayout(preset.layout)}
              size="lg"
              aria-label={t(preset.label)}
              variant="subtle"
              className={clsx({
                [classes.active]: currentLayout === preset.layout,
              })}
            >
              <preset.icon size={18} />
            </ActionIcon>
          </Tooltip>
        ))}

        <div className={classes.divider} />

        <Tooltip
          position="top"
          label={copied ? t("Copied") : t("Copy")}
          withinPortal={false}
        >
          <ActionIcon
            onClick={handleCopy}
            size="lg"
            aria-label={t("Copy")}
            variant="subtle"
          >
            {copied ? (
              <IconCheck size={18} color="var(--mantine-color-green-6)" />
            ) : (
              <IconCopy size={18} />
            )}
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
    </BaseBubbleMenu>
  );
}

export default ColumnsMenu;
