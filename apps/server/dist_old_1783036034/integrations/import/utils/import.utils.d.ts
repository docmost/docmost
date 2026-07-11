import { ExportMetadata } from '../../../common/helpers/types/export-metadata.types';
export declare function buildAttachmentCandidates(extractDir: string): Promise<Map<string, string>>;
export declare function resolveRelativeAttachmentPath(raw: string, pageDir: string, attachmentCandidates: Map<string, string>): string | null;
export declare function collectMarkdownAndHtmlFiles(dir: string): Promise<string[]>;
export declare function stripNotionID(fileName: string): string;
export declare function extractNotionPartialId(folderName: string): {
    prefix: string;
    suffix: string;
} | null;
export declare function encodeFilePath(filePath: string): string;
export declare function readDocmostMetadata(extractDir: string): Promise<ExportMetadata | null>;
