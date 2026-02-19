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
  directChildCount?: number;
  directChildFolderCount?: number;
  descendantFolderCount?: number;
  descendantFileCount?: number;
  descendantTotalCount?: number;
  hasChildren: boolean;
  children: SpaceTreeNode[];
};
