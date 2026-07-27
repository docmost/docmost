import { ISpace } from "@/features/space/types/space.types.ts";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types.ts";

export interface IPage {
  id: string;
  slugId: string;
  title: string;
  content: string;
  icon: string;
  coverPhoto: string;
  parentPageId: string;
  creatorId: string;
  spaceId: string;
  workspaceId: string;
  isLocked: boolean;
  isBase: boolean;
  isEncrypted: boolean;
  encryptionMeta?: EncryptionMeta;
  /** set when this page is keyed to another page's DEK (encrypted section) */
  encryptionRootId?: string | null;
  encryptedVersion?: number;
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
  title: string;
  parentPageId: string;
  icon: string;
  coverPhoto: string;
  position: string;
  isLocked: boolean;
  spaceId: string;
  /** only sent when creating a page inside an encrypted section */
  encryptedBlob?: string;
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
  Docx = "docx",
}
