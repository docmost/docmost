export type PageNodeType = "file" | "folder";

export type SpaceTreeNode = {
  id: string;
  slugId: string;
  name: string;
  icon?: string;
  position: string;
  spaceId: string;
  parentPageId: string | null;
  nodeType?: PageNodeType;
  isPinned?: boolean;
  pinnedAt?: Date | string | null;
  hasChildren: boolean;
  children: SpaceTreeNode[];
};
