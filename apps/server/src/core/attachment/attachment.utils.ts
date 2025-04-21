import { MultipartFile } from '@fastify/multipart';
import { randomBytes } from 'crypto';
import { sanitize } from 'sanitize-filename-ts';
import * as path from 'path';
import { AttachmentType } from './attachment.constants';

export interface PreparedFile {
  buffer: Buffer;
  fileName: string;
  fileSize: number;
  fileExtension: string;
  mimeType: string;
}

export async function prepareFile(
  filePromise: Promise<MultipartFile>,
): Promise<PreparedFile> {
  const file = await filePromise;

  if (!file) {
    throw new Error('No file provided');
  }

  try {
    const rand = randomBytes(8).toString('hex');

    const buffer = await file.toBuffer();
    const sanitizedFilename = sanitize(file.filename).replace(/ /g, '_');
    const fileName = sanitizedFilename.slice(0, 255);
    const fileSize = buffer.length;
    const fileExtension = path.extname(file.filename).toLowerCase();

    return {
      buffer,
      fileName,
      fileSize,
      fileExtension,
      mimeType: file.mimetype,
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
    case AttachmentType.WorkspaceLogo:
      return `${workspaceId}/workspace-logo`;
    case AttachmentType.SpaceLogo:
      return `${workspaceId}/space-logos`;
    case AttachmentType.File:
      return `${workspaceId}/files`;
    default:
      return `${workspaceId}/files`;
  }
}

export const validAttachmentTypes = Object.values(AttachmentType);
