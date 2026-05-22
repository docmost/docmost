export type TreeNode<T extends object = object> = T & {
  id: string;
  children?: TreeNode<T>[];
};

export type DropOp =
  | { kind: 'reorder-before'; targetId: string }
  | { kind: 'reorder-after'; targetId: string }
  | { kind: 'make-child'; targetId: string };

export type DropResult = {
  parentId: string | null;
  index: number;
};

export type SiblingsInfo<T extends object> = {
  parentId: string | null;
  siblings: TreeNode<T>[];
  index: number;
};
