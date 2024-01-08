import { MultipartFile } from '@fastify/multipart';
import { randomBytes } from 'crypto';
import { sanitize } from 'sanitize-filename-ts';
import * as path from 'path';

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
  try {
    const rand = randomBytes(4).toString('hex');
    const file = await filePromise;

    if (!file) {
      throw new Error('No file provided');
    }

    const buffer = await file.toBuffer();
    const sanitizedFilename = sanitize(file.filename).replace(/ /g, '_');
    const fileName = `${rand}_${sanitizedFilename}`;
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
    console.error('Error in file preparation:', error);
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

export enum AttachmentType {
  Avatar = 'Avatar',
  WorkspaceLogo = 'WorkspaceLogo',
  File = 'file',
}

export function getAttachmentPath(
  type: AttachmentType,
  workspaceId?: string,
): string {
  if (!workspaceId && type != AttachmentType.Avatar) {
    throw new Error('Workspace ID is required for this attachment type');
  }

  switch (type) {
    case AttachmentType.Avatar:
      return 'avatars';
    case AttachmentType.WorkspaceLogo:
      return `${workspaceId}/logo`;
    default:
      return `${workspaceId}/files`;
  }
}
