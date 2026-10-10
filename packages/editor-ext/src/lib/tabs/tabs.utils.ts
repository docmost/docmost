import { findParentNodeClosestToPos } from '@tiptap/core';
import {
  Fragment,
  type Node as PMNode,
  type ResolvedPos,
} from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { generateNodeId } from '../utils';

export const tabLabelAt = (index: number) => `Tab ${index + 1}`;

export const clampIndex = (value: unknown, length: number) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || length <= 0) return 0;
  return Math.max(0, Math.min(Math.trunc(parsed), length - 1));
};

export const indexAfterMove = (index: number, from: number, to: number) => {
  if (index === from) return to;
  if (from < index && index <= to) return index - 1;
  if (to <= index && index < from) return index + 1;
  return index;
};

export function isTabsNode(node: PMNode | null | undefined): node is PMNode {
  return node?.type.name === 'tabs' && node.childCount > 0;
}

export function getTabPos(tabs: PMNode, tabsPos: number, index: number) {
  let pos = tabsPos + 1;
  for (let i = 0; i < index; i += 1) pos += tabs.child(i).nodeSize;
  return pos;
}

export function getPanelContentPos(
  tabs: PMNode,
  tabsPos: number,
  index: number,
) {
  const tabPos = getTabPos(tabs, tabsPos, index);
  return tabPos + 1 + tabs.child(index).child(0).nodeSize + 1;
}

export function withFreshTabIds(fragment: Fragment): Fragment {
  const nodes: PMNode[] = [];
  fragment.forEach((node) => {
    if (node.isTextblock || node.isLeaf) {
      nodes.push(node);
      return;
    }
    const content = withFreshTabIds(node.content);
    nodes.push(
      node.type.name === 'tab'
        ? node.type.create(
            { ...node.attrs, id: generateNodeId() },
            content,
            node.marks,
          )
        : node.copy(content),
    );
  });
  return Fragment.from(nodes);
}

// keeps the first tab with each id and gives empty or repeated ones a fresh id
export function fixTabIds(tr: Transaction) {
  const seen = new Set<string>();
  const repairs: number[] = [];
  tr.doc.descendants((node, pos) => {
    if (node.type.name === 'tab') {
      const { id } = node.attrs;
      if (!id || seen.has(id)) repairs.push(pos);
      else seen.add(id);
    }
    return !node.isTextblock;
  });
  repairs.forEach((pos) => {
    let id = generateNodeId();
    while (seen.has(id)) id = generateNodeId();
    seen.add(id);
    tr.setNodeAttribute(pos, 'id', id);
  });
  return repairs.length > 0;
}

export const isInsideTabs = ($pos: ResolvedPos) =>
  Boolean(findParentNodeClosestToPos($pos, (node) => node.type.name === 'tabs'));

function tabsBlockContent(tabs: PMNode) {
  const { heading } = tabs.type.schema.nodes;
  const nodes: PMNode[] = [];
  tabs.forEach((tab) => {
    const [label, panel] = [tab.child(0), tab.child(1)];
    if (label.content.size) {
      nodes.push(heading.create({ level: 4 }, label.content));
    }
    panel.forEach((node) => nodes.push(node));
  });
  return Fragment.from(nodes);
}

// tabs can't nest, so a whole tabs block becomes its labels as headings, as in
// the markdown export, followed by their content. the open edges of a copied
// selection are context rather than blocks. null when there is nothing to flatten
export function flattenTabsBlocks(
  fragment: Fragment,
  openStart = 0,
  openEnd = 0,
): Fragment | null {
  let changed = false;
  const nodes: PMNode[] = [];
  fragment.forEach((node, _, index) => {
    const openLeft = index === 0 ? openStart : 0;
    const openRight = index === fragment.childCount - 1 ? openEnd : 0;
    if (node.type.name === 'tabs' && !openLeft && !openRight) {
      changed = true;
      const content = tabsBlockContent(node);
      (flattenTabsBlocks(content) ?? content).forEach((child) =>
        nodes.push(child),
      );
      return;
    }
    const content =
      node.isTextblock || node.isLeaf
        ? null
        : flattenTabsBlocks(
            node.content,
            Math.max(openLeft - 1, 0),
            Math.max(openRight - 1, 0),
          );
    if (content) changed = true;
    nodes.push(content ? node.copy(content) : node);
  });
  return changed ? Fragment.from(nodes) : null;
}

// a whole tabs block anywhere in the fragment, with the same open edges rule
export function hasTabsBlock(
  fragment: Fragment,
  openStart = 0,
  openEnd = 0,
): boolean {
  let found = false;
  fragment.forEach((node, _, index) => {
    if (found || node.isTextblock || node.isLeaf) return;
    const openLeft = index === 0 ? openStart : 0;
    const openRight = index === fragment.childCount - 1 ? openEnd : 0;
    found =
      (node.type.name === 'tabs' && !openLeft && !openRight) ||
      hasTabsBlock(
        node.content,
        Math.max(openLeft - 1, 0),
        Math.max(openRight - 1, 0),
      );
  });
  return found;
}
