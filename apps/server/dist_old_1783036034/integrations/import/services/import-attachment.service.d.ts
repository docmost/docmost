import { KyselyDB } from "../../../database/types/kysely.types";
import { StorageService } from '../../storage/storage.service';
import { FileTask } from "../../../database/types/entity.types";
import { Queue } from 'bullmq';
interface AttachmentInfo {
    href: string;
    fileName: string;
    mimeType: string;
}
export declare class ImportAttachmentService {
    private readonly storageService;
    private readonly db;
    private attachmentQueue;
    private readonly logger;
    private readonly CONCURRENT_UPLOADS;
    private readonly MAX_RETRIES;
    private readonly RETRY_DELAY;
    constructor(storageService: StorageService, db: KyselyDB, attachmentQueue: Queue);
    processAttachments(opts: {
        html: string;
        pageRelativePath: string;
        extractDir: string;
        pageId: string;
        fileTask: FileTask;
        attachmentCandidates: Map<string, string>;
        pageAttachments?: AttachmentInfo[];
        isConfluenceImport?: boolean;
    }): Promise<string>;
    private analyzeAttachments;
    private createDrawioSvg;
    private uploadWithRetry;
}
export {};
