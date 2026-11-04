import { Node, mergeAttributes } from '@tiptap/core';
import { Slice } from '@tiptap/pm/model';
import {
  Plugin,
  PluginKey,
  Selection,
  type EditorState,
} from '@tiptap/pm/state';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import type { ComponentType } from 'react';
import { generateNodeId } from '../utils';
import {
  getActiveTabIndex,
  setActiveTabMeta,
  tabIdsPlugin,
  tabsViewPlugin,
} from './tabs-state';
import {
  clampIndex,
  fixTabIds,
  getPanelContentPos,
  getTabPos,
  flattenTabsBlocks,
  hasTabsBlock,
  indexAfterMove,
  isInsideTabs,
  isTabsNode,
  tabLabelAt,
  withFreshTabIds,
} from './tabs.utils';

export interface TabsOptions {
  HTMLAttributes: Record<string, unknown>;
  view: ComponentType<ReactNodeViewProps<HTMLElement>> | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tabs: {
      insertTabs: () => ReturnType;
      addTab: (tabsPos: number) => ReturnType;
      setActiveTab: (index: number, tabsPos: number) => ReturnType;
      showTabAt: (pos: number) => ReturnType;
      duplicateTab: (index: number, tabsPos: number) => ReturnType;
      moveTab: (from: number, to: number, tabsPos: number) => ReturnType;
      renameTab: (index: number, label: string, tabsPos: number) => ReturnType;
      deleteTab: (index: number, tabsPos: number) => ReturnType;
    };
  }
}

const isInTabStrip = (event: Event) =>
  Boolean((event.target as HTMLElement | null)?.closest?.('[data-tab-strip]'));

export const Tabs = Node.create<TabsOptions>({
  name: 'tabs',
  group: 'block',
  content: 'tab+',
  defining: true,
  isolating: true,

  // the drop cursor listens on the editor directly, so it also sees the strip's
  // tab reorder drags; content is never dropped on the strip
  extendNodeSchema(extension) {
    return extension.name === 'tabs'
      ? {
          disableDropCursor: (_view: unknown, _pos: unknown, event: Event) =>
            isInTabStrip(event),
        }
      : {};
  },

  addOptions() {
    return { HTMLAttributes: {}, view: null };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        { 'data-type': this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },

  addNodeView() {
    if (!this.options.view) return undefined;
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view, {
      // a tab switch only changes the decorations, which the view isn't
      // re-rendered for by default, and the tab strip reads them
      update: ({ updateProps }) => {
        updateProps();
        return true;
      },
    });
  },

  addCommands() {
    const createTab = (schema: EditorState['schema'], label: string) => {
      const { tab, tabLabel, tabPanel, paragraph } = schema.nodes;
      return tab.create({ id: generateNodeId() }, [
        tabLabel.create(null, schema.text(label)),
        tabPanel.create(null, paragraph.create()),
      ]);
    };

    return {
      insertTabs:
        () =>
        ({ tr, state, dispatch }) => {
          // tabs don't nest, for now
          if (isInsideTabs(state.selection.$from)) return false;
          const tabsNode = this.type.create(null, [
            createTab(state.schema, tabLabelAt(0)),
            createTab(state.schema, tabLabelAt(1)),
          ]);
          if (!dispatch) return true;

          tr.replaceSelectionWith(tabsNode).scrollIntoView();

          const firstTabId = tabsNode.child(0).attrs.id;
          let tabsPos = -1;
          tr.doc.descendants((node, pos) => {
            if (tabsPos !== -1) return false;
            if (
              node.type === this.type &&
              node.child(0).attrs.id === firstTabId
            ) {
              tabsPos = pos;
              return false;
            }
            return !node.isTextblock;
          });

          if (tabsPos !== -1) {
            const panelPos = getPanelContentPos(tabsNode, tabsPos, 0);
            tr.setSelection(Selection.near(tr.doc.resolve(panelPos)));
          }
          return true;
        },

      addTab:
        (tabsPos) =>
        ({ tr, state, dispatch }) => {
          const tabs = tr.doc.nodeAt(tabsPos);
          if (!isTabsNode(tabs)) return false;
          if (!dispatch) return true;

          const tab = createTab(state.schema, tabLabelAt(tabs.childCount));
          const insertPos = tabsPos + tabs.nodeSize - 1;
          tr.insert(insertPos, tab);
          setActiveTabMeta(tr, {
            tabsPos,
            tabId: tab.attrs.id,
            index: tabs.childCount,
          });
          const panelPos = insertPos + 1 + tab.child(0).nodeSize + 1;
          tr.setSelection(Selection.near(tr.doc.resolve(panelPos)));
          return true;
        },

      setActiveTab:
        (index, tabsPos) =>
        ({ tr, dispatch }) => {
          const tabs = tr.doc.nodeAt(tabsPos);
          if (!isTabsNode(tabs)) return false;

          const next = clampIndex(index, tabs.childCount);
          if (dispatch) {
            setActiveTabMeta(tr, {
              tabsPos,
              tabId: tabs.child(next).attrs.id,
              index: next,
            });
          }
          return true;
        },

      showTabAt:
        (pos) =>
        ({ tr, dispatch }) => {
          const $pos = tr.doc.resolve(pos);
          let found = false;
          for (let depth = 1; depth < $pos.depth; depth += 1) {
            const tabs = $pos.node(depth);
            if (!isTabsNode(tabs)) continue;

            found = true;
            const index = $pos.index(depth);
            if (dispatch) {
              setActiveTabMeta(tr, {
                tabsPos: $pos.before(depth),
                tabId: tabs.child(index).attrs.id,
                index,
              });
            }
          }
          return found;
        },

      duplicateTab:
        (index, tabsPos) =>
        ({ tr, dispatch }) => {
          const tabs = tr.doc.nodeAt(tabsPos);
          if (!isTabsNode(tabs)) return false;
          if (!dispatch) return true;

          const sourceIndex = clampIndex(index, tabs.childCount);
          const source = tabs.child(sourceIndex);
          const copy = source.type.create(
            { ...source.attrs, id: generateNodeId() },
            withFreshTabIds(source.content),
          );
          tr.insert(
            getTabPos(tabs, tabsPos, sourceIndex) + source.nodeSize,
            copy,
          );
          setActiveTabMeta(tr, {
            tabsPos,
            tabId: copy.attrs.id,
            index: sourceIndex + 1,
          });
          return true;
        },

      moveTab:
        (from, to, tabsPos) =>
        ({ state, tr, dispatch }) => {
          const tabs = tr.doc.nodeAt(tabsPos);
          if (!isTabsNode(tabs) || tabs.childCount < 2) return false;

          const fromIndex = clampIndex(from, tabs.childCount);
          const toIndex = clampIndex(to, tabs.childCount);
          if (fromIndex === toIndex) return false;
          if (!dispatch) return true;

          const activeIndex = getActiveTabIndex(state, tabsPos);
          const activeTabId = tabs.child(activeIndex).attrs.id;
          const moved = tabs.child(fromIndex);
          const fromPos = getTabPos(tabs, tabsPos, fromIndex);

          tr.delete(fromPos, fromPos + moved.nodeSize);
          const remaining = tr.doc.nodeAt(tabsPos)!;
          tr.insert(getTabPos(remaining, tabsPos, toIndex), moved);
          setActiveTabMeta(tr, {
            tabsPos,
            tabId: activeTabId,
            index: indexAfterMove(activeIndex, fromIndex, toIndex),
          });
          return true;
        },

      renameTab:
        (index, label, tabsPos) =>
        ({ tr, state, dispatch }) => {
          const tabs = tr.doc.nodeAt(tabsPos);
          if (!isTabsNode(tabs)) return false;

          const tabIndex = clampIndex(index, tabs.childCount);
          const labelPos = getTabPos(tabs, tabsPos, tabIndex) + 1;
          const labelNode = tr.doc.nodeAt(labelPos);
          if (labelNode?.type.name !== 'tabLabel') return false;
          if (!dispatch) return true;

          const from = labelPos + 1;
          const to = from + labelNode.content.size;
          if (label) tr.replaceWith(from, to, state.schema.text(label));
          else tr.delete(from, to);
          return true;
        },

      deleteTab:
        (index, tabsPos) =>
        ({ state, tr, dispatch }) => {
          const tabs = tr.doc.nodeAt(tabsPos);
          if (!isTabsNode(tabs)) return false;
          if (!dispatch) return true;

          if (tabs.childCount === 1) {
            tr.delete(tabsPos, tabsPos + tabs.nodeSize);
            return true;
          }

          const target = clampIndex(index, tabs.childCount);
          const activeIndex = getActiveTabIndex(state, tabsPos);
          const tabPos = getTabPos(tabs, tabsPos, target);
          tr.delete(tabPos, tabPos + tabs.child(target).nodeSize);

          if (target === activeIndex) {
            const next = Math.min(target, tabs.childCount - 2);
            const remaining = tr.doc.nodeAt(tabsPos)!;
            setActiveTabMeta(tr, {
              tabsPos,
              tabId: remaining.child(next).attrs.id,
              index: next,
            });
          }
          return true;
        },
    };
  },

  // content loaded straight into the editor never passes through a transaction
  onCreate() {
    const { tr } = this.editor.state;
    if (fixTabIds(tr)) {
      this.editor.view.dispatch(tr.setMeta('addToHistory', false));
    }
  },

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      new Plugin({
        key: new PluginKey('tabsDragGuard'),
        props: {
          // the strip's tab reorder is its own drag and drop. the node view
          // already stops its dragstart; claim the rest so the editor doesn't
          // take them as a content drag. they still reach the dnd library
          handleDOMEvents: {
            dragenter: (_view, event) => isInTabStrip(event),
            dragover: (_view, event) => isInTabStrip(event),
            drop: (_view, event) => isInTabStrip(event),
          },
        },
      }),
      new Plugin({
        key: new PluginKey('tabsPaste'),
        props: {
          transformPasted: (slice) =>
            new Slice(
              withFreshTabIds(slice.content),
              slice.openStart,
              slice.openEnd,
            ),
          handlePaste: (view, _event, slice) => {
            if (!isInsideTabs(view.state.selection.$from)) return false;
            const content = flattenTabsBlocks(
              slice.content,
              slice.openStart,
              slice.openEnd,
            );
            if (!content) return false;
            view.dispatch(
              view.state.tr
                .replaceSelection(
                  new Slice(content, slice.openStart, slice.openEnd),
                )
                .scrollIntoView()
                .setMeta('paste', true)
                .setMeta('uiEvent', 'paste'),
            );
            return true;
          },
          // a dragged tabs block can't land inside another, so the drop does nothing
          handleDrop: (view, event, slice) => {
            if (!hasTabsBlock(slice.content, slice.openStart, slice.openEnd)) {
              return false;
            }
            const target = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            return Boolean(
              target && isInsideTabs(view.state.doc.resolve(target.pos)),
            );
          },
        },
      }),
      new Plugin({
        key: new PluginKey('tabsReveal'),
        props: {
          handleDOMEvents: {
            // find in page, an anchor link, or a scroll to an element reaching into a hidden tab
            beforematch: (view, event) => {
              if (event.target instanceof Element) {
                editor.commands.showTabAt(view.posAtDOM(event.target, 0));
              }
              return false;
            },
          },
        },
      }),
      tabsViewPlugin(),
      tabIdsPlugin(),
    ];
  },
});
