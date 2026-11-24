import { MultipartFile } from '@fastify/multipart';
import * as path from 'path';
import { AttachmentType, DiagramType } from './attachment.constants';
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

export function diagramFileName(name: string, type: DiagramType): string | null {
  const stem = sanitizeFileName(name.trim(), { preserveSpaces: true });
  const fileName = `${stem}.${type}.svg`;
  return stem && Buffer.byteLength(fileName) <= 255 ? fileName : null;
}

export async function prepareFile(
  filePromise: Promise<MultipartFile>,
  options: { skipBuffer?: boolean; preserveSpaces?: boolean } = {},
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

    const sanitizedFilename = sanitizeFileName(file.filename, {
      preserveSpaces: options.preserveSpaces,
    });
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
