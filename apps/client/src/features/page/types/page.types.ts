import { ISpace } from "@/features/space/types/space.types.ts";

export interface IPage {
  id: string;
  slugId: string;
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
  nodeType?: "file" | "folder";
  isPinned?: boolean;
  pinnedAt?: Date | string | null;
  creator: ICreator;
  lastUpdatedBy: ILastUpdatedBy;
  deletedBy: IDeletedBy;
  space: Partial<ISpace>;
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
  parentPageId?: string | null;
}

export interface IBatchMovePages {
  spaceId: string;
  selectionMode: "ids" | "filtered";
  pageIds?: string[];
  titleContains?: string;
  excludedPageIds?: string[];
  targetFolderId: string;
}

export interface IBatchMoveResult {
  taskId: string | null;
  movedCount: number;
  failedCount: number;
  conflicts: Array<{ pageId: string; reason: string }>;
}

export interface IFolderMigrationStartPayload {
  spaceId: string;
}

export interface IFolderMigrationStartResult {
  jobId: string;
  status: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  migrationFolderId: string;
}

export interface IFolderMigrationRollbackPayload {
  jobId: string;
}

export interface IFolderMigrationRollbackResult {
  jobId: string;
  rolledBackCount: number;
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
}

export interface IPageInput {
  pageId: string;
  title: string;
  parentPageId: string | null;
  nodeType?: "file" | "folder";
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
