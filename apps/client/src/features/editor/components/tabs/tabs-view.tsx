import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import {
  NodeViewContent,
  NodeViewWrapper,
  useEditorState,
  type NodeViewProps,
} from "@tiptap/react";
import { ActionIcon, Scroller, Tabs, Tooltip } from "@mantine/core";
import { IconLayoutNavbar, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { findParentNode } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { getShownTabIndex, isTextSelected } from "@docmost/editor-ext";
import TabSlot, { TAB_DRAG_TYPE } from "./tab-slot";
import TabsToolbar from "./tabs-toolbar";
import type { TabActions } from "./tabs.types";

export default function TabsView({
  node,
  editor,
  getPos,
  innerDecorations,
}: NodeViewProps) {
  const { t } = useTranslation();
  const instanceId = useId();
  const contentId = `${instanceId}-content`;
  const headerRef = useRef<HTMLDivElement>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);

  const isEditable = useEditorState({
    editor,
    selector: (ctx) => ctx.editor?.isEditable ?? false,
  });

  const isEditorFocused = useEditorState({
    editor,
    selector: (ctx) => ctx.editor?.isFocused ?? false,
  });

  // the innermost tabs block around the cursor shows the toolbar. selectors
  // run on every transaction, so match the node rather than look up positions
  const showToolbar = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor?.isEditable) return false;

      const { selection } = ctx.editor.state;
      if (selection instanceof NodeSelection) return selection.node === node;
      const parent = findParentNode((n) => n.type.name === "tabs")(selection);
      return parent?.node === node && !isTextSelected(ctx.editor);
    },
  });

  const tabs = Array.from({ length: node.childCount }, (_, index) => {
    const tab = node.child(index);
    return {
      key: tab.attrs.id || String(index),
      label: tab.firstChild?.textContent ?? "",
    };
  });
  const activeIndex = getShownTabIndex(node, innerDecorations);

  const runAtTabsPos = useCallback(
    (run: (tabsPos: number) => void) => {
      const pos = getPos();
      if (typeof pos === "number") run(pos);
    },
    [getPos],
  );

  const activate = useCallback(
    (index: number) =>
      runAtTabsPos((pos) => editor.commands.setActiveTab(index, pos)),
    [editor, runAtTabsPos],
  );

  const addTab = () =>
    runAtTabsPos((pos) => {
      if (!editor.commands.addTab(pos)) return;
      const tabsNode = editor.state.doc.nodeAt(pos);
      const added = tabsNode?.lastChild;
      if (tabsNode && added) {
        setRenamingKey(added.attrs.id || String(tabsNode.childCount - 1));
      }
    });

  const actions: TabActions = {
    rename: (index) => setRenamingKey(tabs[index]?.key ?? null),
    finishRename: (index, label) => {
      setRenamingKey(null);
      if (label === null) return;
      runAtTabsPos((pos) => {
        const next = label.trim();
        const current =
          editor.state.doc.nodeAt(pos)?.maybeChild(index)?.firstChild
            ?.textContent ?? "";
        if (next && next !== current) {
          editor.commands.renameTab(index, next, pos);
        }
      });
    },
    duplicate: (index) =>
      runAtTabsPos((pos) => editor.commands.duplicateTab(index, pos)),
    move: (from, to) =>
      runAtTabsPos((pos) => editor.commands.moveTab(from, to, pos)),
    remove: (index) =>
      runAtTabsPos((pos) => editor.commands.deleteTab(index, pos)),
  };

  // pan the strip when a dragged tab nears its edges
  useEffect(() => {
    const scroller =
      headerRef.current?.querySelector<HTMLElement>(".dm-tabs__scroller");
    if (!scroller) return;

    return autoScrollForElements({
      element: scroller,
      canScroll: ({ source }) =>
        source.data.type === TAB_DRAG_TYPE &&
        source.data.instanceId === instanceId,
      getAllowedAxis: () => "horizontal",
    });
  }, [instanceId]);

  // reveal the active tab inside the strip without scrolling the page
  useEffect(() => {
    const scroller =
      headerRef.current?.querySelector<HTMLElement>(".dm-tabs__scroller");
    const slot = scroller?.querySelector<HTMLElement>(
      `[data-tab-index="${activeIndex}"]`,
    );
    if (!scroller || !slot) return;

    // keep the active tab clear of the scroller's overlaid edge controls
    const inset =
      scroller.parentElement?.querySelector<HTMLElement>(
        ":scope > [data-position]",
      )?.offsetWidth ?? 0;
    const bounds = scroller.getBoundingClientRect();
    const slotBounds = slot.getBoundingClientRect();
    const visibleLeft = bounds.left + inset;
    const visibleRight = bounds.right - inset;
    if (slotBounds.left < visibleLeft) {
      scroller.scrollBy({
        left: slotBounds.left - visibleLeft,
        behavior: "smooth",
      });
    } else if (slotBounds.right > visibleRight) {
      scroller.scrollBy({
        left: slotBounds.right - visibleRight,
        behavior: "smooth",
      });
    }
  }, [activeIndex, tabs.length]);

  return (
    <NodeViewWrapper
      data-type="tabs"
      className="dm-tabs"
      onFocus={() => setHasFocusWithin(true)}
      onBlur={(event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocusWithin(false);
        }
      }}
    >
      {showToolbar && (isEditorFocused || hasFocusWithin) && (
        <TabsToolbar editor={editor} getPos={getPos} />
      )}
      {/* the drag handle shows this instead of a snapshot of the block */}
      <div data-drag-preview hidden className="dm-tabs-drag-preview">
        <IconLayoutNavbar size={16} />
        <span>{tabs.map((tab) => tab.label || t("Untitled")).join(" · ")}</span>
      </div>
      <div
        ref={headerRef}
        className="dm-tabs__header"
        contentEditable={false}
        data-tab-strip
      >
        <Tabs
          unstyled
          className="dm-tabs__tabs"
          value={String(activeIndex)}
          onChange={(value) => {
            if (value !== null) activate(Number(value));
          }}
        >
          <Scroller
            draggable={false}
            classNames={{ container: "dm-tabs__scroller" }}
          >
            <Tabs.List className="dm-tabs__list">
              {tabs.map((tab, index) => (
                <TabSlot
                  key={tab.key}
                  index={index}
                  tabCount={tabs.length}
                  label={tab.label}
                  isActive={index === activeIndex}
                  isEditable={isEditable}
                  isRenaming={renamingKey === tab.key}
                  instanceId={instanceId}
                  contentId={contentId}
                  actions={actions}
                />
              ))}
            </Tabs.List>
          </Scroller>
        </Tabs>
        {isEditable && (
          <div className="dm-tabs__actions">
            <Tooltip label={t("Add tab")}>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={t("Add tab")}
                onClick={addTab}
              >
                <IconPlus size={18} />
              </ActionIcon>
            </Tooltip>
          </div>
        )}
      </div>
      <NodeViewContent id={contentId} className="dm-tabs__content" />
    </NodeViewWrapper>
  );
}
