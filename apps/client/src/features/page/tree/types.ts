export type SpaceTreeNode = {
  id: string;
  slugId: string;
  name: string;
  icon?: string;
  coverPhoto?: string | null;
  position: string;
  spaceId: string;
  parentPageId: string;
  hasChildren: boolean;
  isBase?: boolean;
  canEdit?: boolean;
  children: SpaceTreeNode[];
};
