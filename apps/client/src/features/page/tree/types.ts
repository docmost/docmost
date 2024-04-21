export type SpaceTreeNode = {
  id: string;
  name: string;
  icon?: string;
  position: string;
  slug?: string;
  spaceId: string;
  parentPageId: string;
  hasChildren: boolean;
  children: SpaceTreeNode[];
};
