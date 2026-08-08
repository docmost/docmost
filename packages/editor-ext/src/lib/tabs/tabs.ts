import { Node, mergeAttributes } from '@tiptap/core';
import { Fragment, type Node as PMNode } from '@tiptap/pm/model';
import { TextSelection, Transaction, type EditorState } from '@tiptap/pm/state';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import type { ComponentType } from 'react';
import { generateNodeId } from '../utils';

export interface TabsOptions {
  HTMLAttributes: Record<string, unknown>;
  view: ComponentType<ReactNodeViewProps<HTMLElement>> | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tabs: {
      insertTabs: () => ReturnType;
      insertTab: (pos: string) => ReturnType;
      setActiveTab: (index: number, tabsPos: number) => ReturnType;
      updateTabLabel: (
        index: number,
        label: string,
        tabsPos: number,
      ) => ReturnType;
    };
  }
}

export const Tabs = Node.create<TabsOptions>({
  name: 'tabs',
  group: 'block',
  content: 'tab+',
  defining: true,
  isolating: true,

  addOptions() {
    return { HTMLAttributes: {}, view: null };
  },

  addAttributes() {
    return {
      activeTab: {
        default: 0,
        parseHTML: (element) =>
          Number(element.getAttribute('data-active-tab')) || 0,
        renderHTML: (attributes) => ({
          'data-active-tab': clampIndex(attributes.activeTab),
        }),
      },
    };
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
    return ReactNodeViewRenderer(this.options.view);
  },

  addCommands() {
    const createTab = (
      schema: EditorState['schema'],
      label: string,
      active: boolean,
    ) => {
      const { tab, tabLabel, tabPanel, paragraph } = schema.nodes;
      if (!tab || !tabLabel || !tabPanel || !paragraph) return null;

      return tab.create({ id: generateNodeId(), active }, [
        tabLabel.create(null, schema.text(label || ' ')),
        tabPanel.create(null, paragraph.create()),
      ]);
    };

    const resolveTabs = (state: EditorState) => {
      const { $from } = state.selection;
      let depth = $from.depth;

      while (depth >= 0) {
        const node = $from.node(depth);
        if (node.type.name === 'tabs') {
          return {
            node,
            pos: $from.before(depth),
          };
        }
        depth--;
      }

      return null;
    };

    const resolveTarget = (state: EditorState, pos: number) => {
      const node = state.doc.nodeAt(pos);
      return { node, pos: pos };
    };

    const getTabPos = (doc: PMNode, tabsPos: number, tabIndex: number) => {
      const pos = doc.resolve(tabsPos + 1);
      return pos.posAtIndex(tabIndex, pos.depth);
    };

    const applyActiveTabState = (
      tr: Transaction,
      tabsPos: number,
      previousIndex: number,
      nextIndex: number,
    ) => {
      const tabsNode = tr.doc.nodeAt(tabsPos);
      if (tabsNode?.type.name !== 'tabs' || tabsNode.childCount <= 0) {
        return null;
      }

      const prev = clampIndex(previousIndex, tabsNode.childCount);
      const next = clampIndex(nextIndex, tabsNode.childCount);

      tr.setNodeMarkup(tabsPos, undefined, {
        ...tabsNode.attrs,
        activeTab: next,
      });

      const prevTabPos = getTabPos(tr.doc, tabsPos, prev);
      const nextTabPos = getTabPos(tr.doc, tabsPos, next);

      if (prev !== next) {
        const prevTabNode = tr.doc.nodeAt(prevTabPos);
        if (prevTabNode) {
          tr.setNodeMarkup(prevTabPos, undefined, {
            ...prevTabNode.attrs,
            active: false,
          });
        }
      }

      const nextTabNode = tr.doc.nodeAt(nextTabPos);
      if (nextTabNode) {
        tr.setNodeMarkup(nextTabPos, undefined, {
          ...nextTabNode.attrs,
          active: true,
        });
      }

      return nextTabPos;
    };

    return {
      insertTabs:
        () =>
        ({ tr, state, dispatch }) => {
          const firstTab = createTab(state.schema, 'Tab 1', true);
          const secondTab = createTab(state.schema, 'Tab 2', false);
          if (!firstTab || !secondTab) return false;

          const tabsNode = this.type.create(
            {
              activeTab: 0,
            },
            Fragment.fromArray([firstTab, secondTab]),
          );

          const insertionPos = tr.selection.from;
          tr.replaceSelectionWith(tabsNode).scrollIntoView();

          const firstTabPos = getTabPos(tr.doc, insertionPos, 0);
          const firstTabNode = tr.doc.nodeAt(firstTabPos);
          if (!firstTabNode) return false;

          const labelSize = firstTabNode.child(0)?.nodeSize ?? 0;
          const panelContentPos = firstTabPos + 2 + labelSize + 2;

          tr.setSelection(
            TextSelection.near(tr.doc.resolve(panelContentPos), 1),
          );

          if (dispatch) dispatch(tr);
          return true;
        },

      insertTab:
        (pos: string) =>
        ({ state, tr, dispatch }) => {
          const tabs = resolveTabs(state);
          if (!tabs || tabs.node.childCount <= 0) return false;

          const currentTabIndex = clampIndex(
            tabs.node.attrs.activeTab,
            tabs.node.childCount,
          );

          const insertIndex =
            pos === 'right' ? currentTabIndex + 1 : currentTabIndex;

          const newTab = createTab(state.schema, 'Tab', false);
          if (!newTab) return false;

          const insertPos = getTabPos(state.doc, tabs.pos, insertIndex);
          tr.insert(insertPos, newTab);

          const insertedTabPos = getTabPos(tr.doc, tabs.pos, insertIndex);
          tr.setNodeMarkup(insertedTabPos, undefined, {
            ...newTab.attrs,
            active: true,
          });

          const previousActiveIndex =
            pos === 'left' ? currentTabIndex + 1 : currentTabIndex;

          const activeTabPos = applyActiveTabState(
            tr,
            tabs.pos,
            previousActiveIndex,
            insertIndex,
          );
          if (activeTabPos == null) return false;

          const tabNode = tr.doc.nodeAt(activeTabPos);
          const labelSize = tabNode?.child(0).nodeSize ?? 0;
          const panelContentPos = activeTabPos + 1 + labelSize + 1;

          tr.setSelection(
            TextSelection.near(tr.doc.resolve(panelContentPos), 1),
          );

          if (dispatch) dispatch(tr);
          return true;
        },

      setActiveTab:
        (index, tabsPos) =>
        ({ state, tr, dispatch }) => {
          const target = resolveTarget(state, tabsPos);
          if (!target || target.node.childCount <= 0) return false;

          const nextIndex = clampIndex(index, target.node.childCount);
          const prevIndex = clampIndex(
            target.node.attrs.activeTab,
            target.node.childCount,
          );

          const activeTabPos = applyActiveTabState(
            tr,
            target.pos,
            prevIndex,
            nextIndex,
          );
          if (activeTabPos == null) return false;

          const tabNode = tr.doc.nodeAt(activeTabPos);
          const labelSize = tabNode?.child(0).nodeSize ?? 0;
          const panelContentPos = activeTabPos + 1 + labelSize + 1;

          tr.setSelection(
            TextSelection.near(tr.doc.resolve(panelContentPos), 1),
          );

          if (dispatch) dispatch(tr.scrollIntoView());
          return true;
        },

      updateTabLabel:
        (index, label, tabsPos) =>
        ({ state, tr, dispatch }) => {
          const target = resolveTarget(state, tabsPos);
          if (!target) return false;

          const labelIndex = clampIndex(index, target.node.childCount);
          const $tabs = state.doc.resolve(target.pos + 1);
          const tabPos = $tabs.posAtIndex(labelIndex, $tabs.depth);

          const labelNode = state.doc.nodeAt(tabPos + 1);
          const labelContentPos = tabPos + 2;

          tr.replaceWith(
            labelContentPos,
            labelContentPos + labelNode.content.size,
            state.schema.text(label || ' '),
          );

          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

const clampIndex = (value: unknown, length = Number.MAX_SAFE_INTEGER) => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed) || length <= 0) return 0;
  return Math.max(0, Math.min(Math.trunc(parsed), length - 1));
};
