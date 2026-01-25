import { MultipartFile } from '@fastify/multipart';
import * as path from 'path';
import { AttachmentType } from './attachment.constants';
import { sanitizeFileName } from '../../common/helpers';
import * as sharp from 'sharp';

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
      mimeType: file.mimetype,
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
    default:
      return `${workspaceId}/files`;
  }
}

export const validAttachmentTypes = Object.values(AttachmentType);

export async function compressAndResizeIcon(
  buffer: Buffer,
  attachmentType?: AttachmentType,
): Promise<Buffer> {
  try {
    let sharpInstance = sharp(buffer);
    const metadata = await sharpInstance.metadata();

    const targetWidth = 300;
    const targetHeight = 300;

    // Only resize if image is larger than target dimensions
    if (metadata.width > targetWidth || metadata.height > targetHeight) {
      sharpInstance = sharpInstance.resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Handle based on original format
    if (metadata.format === 'png') {
      // Only flatten avatars to remove transparency
      if (attachmentType === AttachmentType.Avatar) {
        sharpInstance = sharpInstance.flatten({
          background: { r: 255, g: 255, b: 255 },
        });
      }

      return await sharpInstance
        .png({
          quality: 85,
          compressionLevel: 6,
        })
        .toBuffer();
    } else {
      return await sharpInstance
        .jpeg({
          quality: 85,
          progressive: true,
          mozjpeg: true,
        })
        .toBuffer();
    }
  } catch (err) {
    throw err;
  }
}
