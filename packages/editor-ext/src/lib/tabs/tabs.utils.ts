import {
  Fragment,
  type Node as PMNode,
  type ResolvedPos,
} from '@tiptap/pm/model';
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

export function isInsideTabs($pos: ResolvedPos) {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === 'tabs') return true;
  }
  return false;
}

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

export const hasTabsBlock = (fragment: Fragment, openStart = 0, openEnd = 0) =>
  flattenTabsBlocks(fragment, openStart, openEnd) !== null;
