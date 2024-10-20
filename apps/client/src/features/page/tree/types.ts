export type SpaceTreeNode = {
  id: string;
  slugId: string;
  name: string;
  icon?: string;
  position: string;
  isPinned: boolean;
  spaceId: string;
  parentPageId: string;
  hasChildren: boolean;
  children: SpaceTreeNode[];
};
