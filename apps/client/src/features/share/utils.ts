import { IPage } from "@/features/page/types/page.types.ts";
import { sortPositionKeys } from "@/features/page/tree/utils";

export type SharedPageTreeNode = {
  id: string;
  slugId: string;
  name: string;
  icon?: string;
  position: string;
  spaceId: string;
  parentPageId: string;
  hasChildren: boolean;
  children: SharedPageTreeNode[];
  label: string;
  value: string;
};

export function buildSharedPageTree(
  pages: Partial<IPage[]>,
): SharedPageTreeNode[] {
  const pageMap: Record<string, SharedPageTreeNode> = {};

  // Initialize each page as a tree node and store it in a map.
  pages.forEach((page) => {
    pageMap[page.id] = {
      id: page.slugId,
      slugId: page.slugId,
      name: page.title,
      icon: page.icon,
      position: page.position,
      // Initially assume a page has no children.
      hasChildren: false,
      spaceId: page.spaceId,
      parentPageId: page.parentPageId,
      label: page.title || "untitled",
      value: page.id,
      children: [],
    };
  });

  // Build the tree structure.
  const tree: SharedPageTreeNode[] = [];
  pages.forEach((page) => {
    if (page.parentPageId) {
      // If the page has a parent, add it as a child of the parent node.
      const parentNode = pageMap[page.parentPageId];
      if (parentNode) {
        parentNode.children.push(pageMap[page.id]);
        parentNode.hasChildren = true;
      } else {
        // Parent not found – treat this page as a top-level node.
        tree.push(pageMap[page.id]);
      }
    } else {
      // No parentPageId indicates a top-level page.
      tree.push(pageMap[page.id]);
    }
  });

  function sortTree(nodes: SharedPageTreeNode[]): SharedPageTreeNode[] {
    return sortPositionKeys(nodes).map((node: SharedPageTreeNode) => ({
      ...node,
      children: sortTree(node.children),
    }));
  }

  return sortTree(tree);
}
