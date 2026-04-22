import { ISpace } from "@/features/space/types/space.types.ts";

export interface IPage {
  id: string;
  slugId: string;
  nodeType: "page" | "folder";
  title: string;
  content: string;
  icon: string;
  coverPhoto: string;
  parentPageId: string | null;
  creatorId: string;
  spaceId: string;
  workspaceId: string;
  isLocked: boolean;
  lastUpdatedById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
  position: string;
  hasChildren: boolean;
  canEdit?: boolean;
  creator: ICreator;
  lastUpdatedBy: ILastUpdatedBy;
  deletedBy: IDeletedBy;
  contributors?: IContributor[];
  space: Partial<ISpace>;
  permissions?: {
    canEdit: boolean;
    hasRestriction: boolean;
  };
}

export interface IContributor {
  id: string;
  name: string;
  avatarUrl: string;
}

interface ICreator {
  id: string;
  name: string;
  avatarUrl: string;
}
interface ILastUpdatedBy {
  id: string;
  name: string;
  avatarUrl: string;
}

interface IDeletedBy {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface IMovePage {
  pageId: string;
  position?: string;
  after?: string;
  before?: string;
  parentPageId?: string;
}

export interface IMovePageToSpace {
  pageId: string;
  spaceId: string;
}

export interface ICopyPageToSpace {
  pageId: string;
  spaceId?: string;
}

export interface SidebarPagesParams {
  spaceId?: string;
  pageId?: string;
  cursor?: string;
  limit?: number;
}

export interface IPageInput {
  pageId: string;
  nodeType?: "page" | "folder";
  title: string;
  parentPageId: string | null;
  icon: string;
  coverPhoto: string;
  position: string;
  isLocked: boolean;
}

export interface IExportPageParams {
  pageId: string;
  format: ExportFormat;
  includeChildren?: boolean;
  includeAttachments?: boolean;
}

export enum ExportFormat {
  HTML = "html",
  Markdown = "markdown",
}
