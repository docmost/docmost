import { SharedPageTreeNode } from "@/features/share/utils.ts";

// Preorder walk of the whole tree, matching the sidebar's visual order. Drives
// prev/next navigation independently of which nodes are expanded.
export function flattenTreePreorder(
  nodes: SharedPageTreeNode[],
): SharedPageTreeNode[] {
  const out: SharedPageTreeNode[] = [];
  const walk = (list: SharedPageTreeNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

// Ancestors of the node with the given slugId, root-first, excluding the node
// itself. Null when the slugId is not in the tree.
export function findAncestorTrail(
  nodes: SharedPageTreeNode[],
  slugId: string,
): SharedPageTreeNode[] | null {
  const walk = (
    list: SharedPageTreeNode[],
    trail: SharedPageTreeNode[],
  ): SharedPageTreeNode[] | null => {
    for (const node of list) {
      if (node.slugId === slugId) return trail;
      if (node.children?.length) {
        const found = walk(node.children, [...trail, node]);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(nodes, []);
}
