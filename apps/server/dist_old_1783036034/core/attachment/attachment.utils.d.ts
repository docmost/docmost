import { MultipartFile } from '@fastify/multipart';
import { AttachmentType } from './attachment.constants';
export interface PreparedFile {
    buffer?: Buffer;
    fileName: string;
    fileSize: number;
    fileExtension: string;
    mimeType: string;
    multiPartFile?: MultipartFile;
}
export declare function prepareFile(filePromise: Promise<MultipartFile>, options?: {
    skipBuffer?: boolean;
}): Promise<PreparedFile>;
export declare function validateFileType(fileExtension: string, allowedTypes: string[]): void;
export declare function getAttachmentFolderPath(type: AttachmentType, workspaceId: string): string;
export declare const validAttachmentTypes: AttachmentType[];
