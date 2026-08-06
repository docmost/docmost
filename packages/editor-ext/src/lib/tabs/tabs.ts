import { Node, mergeAttributes } from '@tiptap/core';
import { Fragment, type Node as PMNode } from '@tiptap/pm/model';
import { TextSelection, type EditorState } from '@tiptap/pm/state';
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
      setActiveTab: (index: number, tabsPos?: number) => ReturnType;
      updateTabLabel: (
        index: number,
        label: string,
        tabsPos?: number,
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

    const resolveTarget = (state: EditorState, pos: number) => {
      const node = state.doc.nodeAt(pos);
      return { node, pos: pos };
    };

    const getTabPos = (doc: PMNode, tabsPos: number, tabIndex: number) => {
      const pos = doc.resolve(tabsPos + 1);
      return pos.posAtIndex(tabIndex, pos.depth);
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

          const nextTab = getTabPos(state.doc, target.pos, nextIndex);
          if (prevIndex !== nextIndex) {
            const prevTab = getTabPos(state.doc, target.pos, prevIndex);

            tr.setNodeMarkup(target.pos, undefined, {
              ...target.node.attrs,
              activeTab: nextIndex,
            });
            tr.setNodeMarkup(prevTab, undefined, {
              ...target.node.child(prevIndex).attrs,
              active: false,
            });
            tr.setNodeMarkup(nextTab, undefined, {
              ...target.node.child(nextIndex).attrs,
              active: true,
            });
          }

          const tabNode = state.doc.nodeAt(nextTab);
          const labelSize = tabNode?.child(0).nodeSize ?? 0;
          const panelContentPos = nextTab + 1 + labelSize + 1;

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
