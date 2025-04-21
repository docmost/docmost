// repetition for now
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
