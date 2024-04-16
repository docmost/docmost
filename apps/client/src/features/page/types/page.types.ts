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
  position: string;
  hasChildren: boolean;
}

export interface IMovePage {
  pageId: string;
  position?: string;
  after?: string;
  before?: string;
  parentPageId?: string;
}

export interface SidebarPagesParams {
  spaceId: string;
  pageId?: string;
  page?: number; // pagination
}
