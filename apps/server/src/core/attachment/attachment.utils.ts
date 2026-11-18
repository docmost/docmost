import { MultipartFile } from '@fastify/multipart';
import * as path from 'path';
import { AttachmentType } from './attachment.constants';
import { bufferMultipartFile, sanitizeFileName } from '../../common/helpers';
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
      buffer = await bufferMultipartFile(file);
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

// Older Draw.io saves uploaded `diagram.drawio.svg?t=...`; sanitizing dropped only the `?`.
export function normalizeLegacyFileMeta(meta: {
  fileName: string;
  fileExt: string;
  mimeType: string;
}) {
  const queryStart = meta.fileExt.indexOf('?');
  if (queryStart === -1) return meta;

  const fileExt = meta.fileExt.slice(0, queryStart);
  const leakedQuery = meta.fileExt.slice(queryStart + 1);
  const fileName =
    leakedQuery && meta.fileName.endsWith(fileExt + leakedQuery)
      ? meta.fileName.slice(0, -leakedQuery.length)
      : meta.fileName;

  return { fileName, fileExt, mimeType: getMimeType(fileName) };
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
