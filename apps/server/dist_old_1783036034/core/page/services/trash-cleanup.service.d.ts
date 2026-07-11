import { KyselyDB } from "../../../database/types/kysely.types";
import { Queue } from 'bullmq';
export declare class TrashCleanupService {
    private readonly db;
    private attachmentQueue;
    private readonly logger;
    constructor(db: KyselyDB, attachmentQueue: Queue);
    cleanupOldTrash(): Promise<void>;
    private cleanupPage;
}
