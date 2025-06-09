import { IPage } from "@/features/page/types/page.types.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";

export function sortPositionKeys(keys: any[]) {
  return keys.sort((a, b) => {
    if (a.position < b.position) return -1;
    if (a.position > b.position) return 1;
    return 0;
  });
}

export function buildTree(pages: IPage[]): SpaceTreeNode[] {
  const pageMap: Record<string, SpaceTreeNode> = {};

  const tree: SpaceTreeNode[] = [];

  pages.forEach((page) => {
    pageMap[page.id] = {
      id: page.id,
      slugId: page.slugId,
      name: page.title,
      icon: page.icon,
      position: page.position,
      hasChildren: page.hasChildren,
      spaceId: page.spaceId,
      parentPageId: page.parentPageId,
      children: [],
    };
  });

  pages.forEach((page) => {
    tree.push(pageMap[page.id]);
  });

  return sortPositionKeys(tree);
}

export function findBreadcrumbPath(
  tree: SpaceTreeNode[],
  pageId: string,
  path: SpaceTreeNode[] = [],
): SpaceTreeNode[] | null {
  for (const node of tree) {
    if (!node.name || node.name.trim() === "") {
      node.name = "untitled";
    }

    if (node.id === pageId) {
      return [...path, node];
    }

    if (node.children) {
      const newPath = findBreadcrumbPath(node.children, pageId, [
        ...path,
        node,
      ]);
      if (newPath) {
        return newPath;
      }
    }
  }
  return null;
}

export const updateTreeNodeName = (
  nodes: SpaceTreeNode[],
  nodeId: string,
  newName: string,
): SpaceTreeNode[] => {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, name: newName };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateTreeNodeName(node.children, nodeId, newName),
      };
    }
    return node;
  });
};

export const updateTreeNodeIcon = (
  nodes: SpaceTreeNode[],
  nodeId: string,
  newIcon: string,
): SpaceTreeNode[] => {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, icon: newIcon };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateTreeNodeIcon(node.children, nodeId, newIcon),
      };
    }
    return node;
  });
};

export const deleteTreeNode = (
  nodes: SpaceTreeNode[],
  nodeId: string,
): SpaceTreeNode[] => {
  return nodes
    .map((node) => {
      if (node.id === nodeId) {
        return null;
      }

      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: deleteTreeNode(node.children, nodeId),
        };
      }
      return node;
    })
    .filter((node) => node !== null);
};

export function buildTreeWithChildren(items: SpaceTreeNode[]): SpaceTreeNode[] {
  const nodeMap = {};
  let result: SpaceTreeNode[] = [];

  // Create a reference object for each item with the specified structure
  items.forEach((item) => {
    nodeMap[item.id] = { ...item, children: [] };
  });

  // Build the tree array
  items.forEach((item) => {
    const node = nodeMap[item.id];
    if (item.parentPageId !== null) {
      // Find the parent node and add the current node to its children
      nodeMap[item.parentPageId].children.push(node);
    } else {
      // If the item has no parent, it's a root node, so add it to the result array
      result.push(node);
    }
  });

  result = sortPositionKeys(result);

  // Recursively sort the children of each node
  function sortChildren(node: SpaceTreeNode) {
    if (node.children.length > 0) {
      node.hasChildren = true;
      node.children = sortPositionKeys(node.children);
      node.children.forEach(sortChildren);
    }
  }

  result.forEach(sortChildren);

  return result;
}

export function appendNodeChildren(
  treeItems: SpaceTreeNode[],
  nodeId: string,
  children: SpaceTreeNode[],
) {
  // Preserve deeper children if they exist and remove node if deleted
  return treeItems.map((node) => {
    if (node.id === nodeId) {
      const newIds = new Set(children.map((c) => c.id));

      const existingMap = new Map(
        (node.children ?? [])
          .filter((c) => newIds.has(c.id))
          .map((c) => [c.id, c]),
      );

      const merged = children.map((newChild) => {
        const existing = existingMap.get(newChild.id);
        return existing && existing.children
          ? { ...newChild, children: existing.children }
          : newChild;
      });

      return {
        ...node,
        children: merged,
      };
    }

    if (node.children) {
      return {
        ...node,
        children: appendNodeChildren(node.children, nodeId, children),
      };
    }

    return node;
  });
}

/**
 * Merge root nodes; keep existing ones intact, append new ones,
 */
export function mergeRootTrees(
  prevRoots: SpaceTreeNode[],
  incomingRoots: SpaceTreeNode[],
): SpaceTreeNode[] {
  const seen = new Set(prevRoots.map((r) => r.id));

  // add new roots that were not present before
  const merged = [...prevRoots];
  incomingRoots.forEach((node) => {
    if (!seen.has(node.id)) merged.push(node);
  });

  return sortPositionKeys(merged);
}
