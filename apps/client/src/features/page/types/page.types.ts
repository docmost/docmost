export interface IPage {
  pageId: string;
  id: string;
  title: string;
  content: string;
  html: string;
  slug: string;
  icon: string;
  coverPhoto: string;
  editor: string;
  shareId: string;
  parentPageId: string;
  creatorId: string;
  spaceId: string;
  workspaceId: string;
  children: [];
  childrenIds: [];
  isLocked: boolean;
  status: string;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
}

export interface IMovePage {
  pageId: string;
  after?: string;
  before?: string;
  parentId?: string;
}

export interface IWorkspacePageOrder {
  id: string;
  childrenIds: string[];
  workspaceId: string;
}
