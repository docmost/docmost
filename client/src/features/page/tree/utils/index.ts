import { IPage } from '@/features/page/types/page.types';
import { TreeNode } from '@/features/page/tree/types';

export function convertToTree(pages: IPage[], pageOrder: string[]): TreeNode[] {
  const pageMap: { [id: string]: IPage } = {};
  pages.forEach(page => {
    pageMap[page.id] = page;
  });

  function buildTreeNode(id: string): TreeNode | undefined {
    const page = pageMap[id];
    if (!page) return;

    const node: TreeNode = {
      id: page.id,
      name: page.title,
      children: [],
    };

    if (page.icon) node.icon = page.icon;

    if (page.childrenIds && page.childrenIds.length > 0) {
      node.children = page.childrenIds.map(childId => buildTreeNode(childId)).filter(Boolean) as TreeNode[];
    }

    return node;
  }

  return pageOrder.map(id => buildTreeNode(id)).filter(Boolean) as TreeNode[];
}

export function findBreadcrumbPath(tree: TreeNode[], pageId: string, path: TreeNode[] = []): TreeNode[] | null {
  for (const node of tree) {
    if (!node.name || node.name.trim() === "") {
      node.name = "untitled";
    }

    if (node.id === pageId) {
      return [...path, node];
    }

    if (node.children) {
      const newPath = findBreadcrumbPath(node.children, pageId, [...path, node]);
      if (newPath) {
        return newPath;
      }
    }
  }
  return null;
}

export const updateTreeNodeName = (nodes: TreeNode[], nodeId: string, newName: string): TreeNode[] => {
  return nodes.map(node => {
    if (node.id === nodeId) {
      return { ...node, name: newName };
    }
    if (node.children && node.children.length > 0) {
      return { ...node, children: updateTreeNodeName(node.children, nodeId, newName) };
    }
    return node;
  });
};
