export type SpaceTreeNode = {
  id: string;
  slugId: string;
  nodeType: "page" | "folder";
  name: string;
  icon?: string;
  position: string;
  spaceId: string;
  parentPageId: string | null;
  hasChildren: boolean;
  canEdit?: boolean;
  children: SpaceTreeNode[];
};
