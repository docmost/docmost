export type TreeNode = {
  id: string;
  name: string;
  icon?: string;
  slug?: string;
  children: TreeNode[];
};
