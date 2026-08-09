import { InputRule, Node, Range, mergeAttributes } from '@tiptap/core';
import { Fragment, type Node as PMNode } from '@tiptap/pm/model';
import {
  TextSelection,
  type Transaction,
  type EditorState,
} from '@tiptap/pm/state';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import type { ComponentType } from 'react';
import { generateNodeId } from '../utils';
import { findParentNode } from '../table/utils';

export interface TabsOptions {
  HTMLAttributes: Record<string, unknown>;
  view: ComponentType<ReactNodeViewProps<HTMLElement>> | null;
}

const TAB_INPUT_REGEX = /^\s*===\s*["'“”‘’]((?:\\.|[^"'“”‘’\n])+?)["'“”‘’]\s+$/;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tabs: {
      insertTabs: (tabName?: string, range?: Range) => ReturnType;
      insertTab: (pos: 'right' | 'left') => ReturnType;
      moveTab: (pos: 'right' | 'left') => ReturnType;
      setActiveTab: (index: number, tabsPos: number) => ReturnType;
      deleteTabs: () => ReturnType;
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

  addInputRules() {
    return [
      new InputRule({
        find: TAB_INPUT_REGEX,
        handler: ({ range, match }) => {
          const rawLabel = typeof match[1] === 'string' ? match[1] : 'Tab 1';
          const label = rawLabel.replace(/\\(["\\])/g, '$1').trim();

          this.editor.commands.insertTabs(label, range);
        },
      }),
    ];
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

    const selectTabPanel = (
      tr: Transaction,
      tabsPos: number,
      tabPos: number,
    ) => {
      const tabsNode = tr.doc.nodeAt(tabsPos);
      if (tabsNode?.type.name !== 'tabs' || tabsNode.childCount <= 0) {
        return null;
      }

      const tabNode = tr.doc.nodeAt(tabPos);
      const labelSize = tabNode?.child(0).nodeSize ?? 0;
      const panelContentPos = tabPos + 1 + labelSize + 1;

      tr.setSelection(TextSelection.near(tr.doc.resolve(panelContentPos), 1));
    };

    return {
      insertTabs:
        (tabName?: string, range?: Range) =>
        ({ tr, state, dispatch }) => {
          const firstTab = createTab(state.schema, tabName ?? 'Tab 1', true);
          if (!firstTab) return false;

          const tabsNode = this.type.create(
            {
              activeTab: 0,
            },
            Fragment.fromArray([firstTab]),
          );

          const insertionPos = tr.selection.from;

          if (range) {
            tr.replaceRangeWith(
              range.from,
              range.to,
              tabsNode,
            ).scrollIntoView();
          } else {
            tr.replaceSelectionWith(tabsNode).scrollIntoView();
          }

          const firstTabPos = getTabPos(tr.doc, insertionPos, 0);
          const firstTabNode = tr.doc.nodeAt(firstTabPos);
          if (!firstTabNode) return false;

          if (!range) {
            const labelSize = firstTabNode.child(0)?.nodeSize ?? 0;
            const panelContentPos = firstTabPos + 2 + labelSize + 2;

            tr.setSelection(
              TextSelection.near(tr.doc.resolve(panelContentPos), 1),
            );
          }

          if (dispatch) dispatch(tr);
          return true;
        },

      insertTab:
        (pos: 'left' | 'right') =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          const tabs = findParentNode(
            (node) => node.type.name === this.name,
            $from,
          );
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

          selectTabPanel(tr, tabs.pos, insertedTabPos);
          if (dispatch) dispatch(tr);
          return true;
        },

      moveTab:
        (pos: 'left' | 'right') =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          const tabs = findParentNode(
            (node) => node.type.name === this.name,
            $from,
          );
          if (!tabs || tabs.node.childCount <= 1) return false;

          const currentTabIndex = clampIndex(
            tabs.node.attrs.activeTab,
            tabs.node.childCount,
          );

          const targetIndex =
            pos === 'left' ? currentTabIndex - 1 : currentTabIndex + 1;

          if (targetIndex < 0 || targetIndex >= tabs.node.childCount)
            return false;

          const currentTabPos = getTabPos(state.doc, tabs.pos, currentTabIndex);
          const currentTabNode = state.doc.nodeAt(currentTabPos);
          if (!currentTabNode) return false;

          const mappedCurrentTabPos = tr.mapping.map(currentTabPos);
          tr.delete(
            mappedCurrentTabPos,
            mappedCurrentTabPos + currentTabNode.nodeSize,
          );

          const insertPos = getTabPos(tr.doc, tabs.pos, targetIndex);
          tr.insert(insertPos, currentTabNode);

          const movedTabPos = applyActiveTabState(
            tr,
            tabs.pos,
            targetIndex,
            targetIndex,
          );
          selectTabPanel(tr, tabs.pos, movedTabPos);

          if (dispatch) dispatch(tr.scrollIntoView());
          return true;
        },

      setActiveTab:
        (index, tabsPos) =>
        ({ state, tr, dispatch }) => {
          const tabsNode = state.doc.nodeAt(tabsPos);
          if (tabsNode?.childCount <= 0) return false;

          const nextIndex = clampIndex(index, tabsNode.childCount);
          const prevIndex = clampIndex(
            tabsNode.attrs.activeTab,
            tabsNode.childCount,
          );

          const activeTabPos = applyActiveTabState(
            tr,
            tabsPos,
            prevIndex,
            nextIndex,
          );
          if (activeTabPos == null) return false;

          selectTabPanel(tr, tabsPos, activeTabPos);
          if (dispatch) dispatch(tr.scrollIntoView());
          return true;
        },

      updateTabLabel:
        (index, label, tabsPos) =>
        ({ state, tr, dispatch }) => {
          const tabsNode = state.doc.nodeAt(tabsPos);
          if (!tabsNode) return false;

          const labelIndex = clampIndex(index, tabsNode.childCount);
          const $tabs = state.doc.resolve(tabsPos + 1);
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

      deleteTab:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          const tabs = findParentNode(
            (node) => node.type.name === this.name,
            $from,
          );
          if (!tabs) return false;

          if (tabs.node.childCount < 2) {
            this.editor.commands.deleteTabs();
            return true;
          }

          const currentTabIndex = clampIndex(
            tabs.node.attrs.activeTab,
            tabs.node.childCount,
          );

          const currentTabPos = getTabPos(state.doc, tabs.pos, currentTabIndex);
          const currentTabNode = state.doc.nodeAt(currentTabPos);
          if (!currentTabNode) return false;

          const nextTabIndex =
            currentTabIndex < tabs.node.childCount - 1
              ? currentTabIndex
              : currentTabIndex - 1;

          tr.delete(currentTabPos, currentTabPos + currentTabNode.nodeSize);

          const activeTabPos = applyActiveTabState(
            tr,
            tabs.pos,
            nextTabIndex,
            nextTabIndex,
          );
          if (activeTabPos == null) return false;

          selectTabPanel(tr, tabs.pos, activeTabPos);

          if (dispatch) dispatch(tr);
          return true;
        },

      deleteTabs:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          const tabs = findParentNode(
            (node) => node.type.name === this.name,
            $from,
          );
          if (tabs?.node.childCount <= 0) return false;

          tr.delete(tabs.pos, tabs.pos + tabs.node.nodeSize);

          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;

        if (!empty) return false;
        if ($from.parent.content.size > 0) return false;

        const tabsNode = findParentNode(
          (node) => node.type.name === this.name,
          $from,
        );

        if (!tabsNode) return false;
        return editor
          .chain()
          .command(({ tr, state }) => {
            const posAfter = $from.after(tabsNode.depth);
            tr.delete($from.before(), $from.after());

            const targetPos = tr.mapping.map(posAfter);
            const paragraph = state.schema.nodes.paragraph.create();

            tr.insert(targetPos, paragraph);
            tr.setSelection(TextSelection.create(tr.doc, targetPos + 1));
            return true;
          })
          .scrollIntoView()
          .run();
      },
    };
  },
});

const clampIndex = (value: unknown, length = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || length <= 0) return 0;
  return Math.max(0, Math.min(Math.trunc(parsed), length - 1));
};
