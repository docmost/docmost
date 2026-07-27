export type SpaceTreeNode = {
  id: string;
  slugId: string;
  name: string;
  icon?: string;
  position: string;
  spaceId: string;
  parentPageId: string;
  hasChildren: boolean;
  isBase?: boolean;
  isEncrypted?: boolean;
  /** set when this page is keyed to another page's DEK (encrypted section) */
  encryptionRootId?: string | null;
  canEdit?: boolean;
  children: SpaceTreeNode[];
};
