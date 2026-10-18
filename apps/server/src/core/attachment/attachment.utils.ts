import { MultipartFile } from '@fastify/multipart';
import * as path from 'path';
import { AttachmentType } from './attachment.constants';
import { sanitizeFileName } from '../../common/helpers';
import { getMimeType } from '../../common/helpers';

export interface PreparedFile {
  buffer?: Buffer;
  fileName: string;
  fileSize: number;
  fileExtension: string;
  mimeType: string;
  multiPartFile?: MultipartFile;
}

export async function prepareFile(
  filePromise: Promise<MultipartFile>,
  options: { skipBuffer?: boolean } = {},
): Promise<PreparedFile> {
  const file = await filePromise;

  if (!file) {
    throw new Error('No file provided');
  }

  try {
    let buffer: Buffer | undefined;
    let fileSize = 0;

    if (!options.skipBuffer) {
      buffer = await file.toBuffer();
      fileSize = buffer.length;
    }

    const sanitizedFilename = sanitizeFileName(file.filename);
    const fileName = sanitizedFilename.slice(0, 255);
    const fileExtension = path.extname(file.filename).toLowerCase();

    return {
      buffer,
      fileName,
      fileSize,
      fileExtension,
      mimeType: getMimeType(file.filename),
      multiPartFile: file,
    };
  } catch (error) {
    throw error;
  }
}

export function validateFileType(
  fileExtension: string,
  allowedTypes: string[],
) {
  if (!allowedTypes.includes(fileExtension)) {
    throw new Error('Invalid file type');
  }
}

export function getAttachmentFolderPath(
  type: AttachmentType,
  workspaceId: string,
): string {
  switch (type) {
    case AttachmentType.Avatar:
      return `${workspaceId}/avatars`;
    case AttachmentType.WorkspaceIcon:
      return `${workspaceId}/workspace-logos`;
    case AttachmentType.SpaceIcon:
      return `${workspaceId}/space-logos`;
    case AttachmentType.File:
      return `${workspaceId}/files`;
    case AttachmentType.Chat:
      return `${workspaceId}/chat-files`;
    default:
      return `${workspaceId}/files`;
  }
}

export const validAttachmentTypes = Object.values(AttachmentType);

export type UploadMode = 'new' | 'replace' | 'copy-on-write' | 'refuse';

// Published attachments and attachments of approval-controlled pages are never overwritten in place.
export function resolveUploadMode(input: {
  controlled: boolean;
  locked: boolean;
  existing: { publishedAt: Date | null } | null;
}): UploadMode {
  if (!input.existing) return 'new';
  if (input.locked) return 'refuse';
  if (input.controlled || input.existing.publishedAt) return 'copy-on-write';
  return 'replace';
}
