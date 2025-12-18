export interface IAttachment {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileExt: string;
  mimeType: string;
  type: string;
  creatorId: string;
  pageId: string | null;
  spaceId: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export enum AvatarIconType {
  AVATAR = "avatar",
  SPACE_ICON = "space-icon",
  WORKSPACE_ICON = "workspace-icon",
}

export enum AttachmentType {
  AVATAR = "avatar",
  WORKSPACE_ICON = "workspace-icon",
  SPACE_ICON = "space-icon",
  FILE = "file",
}
