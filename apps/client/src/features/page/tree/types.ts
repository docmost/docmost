export type SpaceTreeNode = {
  id: string;
  name: string;
  icon?: string;
  position: string;
  slug?: string;
  spaceId: string;
  hasChildren: boolean;
  children: SpaceTreeNode[];
};
