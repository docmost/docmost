import { KyselyDB } from "../../../database/types/kysely.types";
import { FileTaskStatus } from '../utils/file.utils';
import { StorageService } from '../../storage/storage.service';
import { ImportService } from './import.service';
import { FileTask } from "../../../database/types/entity.types";
import { BacklinkRepo } from "../../../database/repos/backlink/backlink.repo";
import { ImportAttachmentService } from './import-attachment.service';
import { ModuleRef } from '@nestjs/core';
import { PageService } from '../../../core/page/services/page.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IAuditService } from '../../../integrations/audit/audit.service';
export declare class FileImportTaskService {
    private readonly storageService;
    private readonly importService;
    private readonly pageService;
    private readonly backlinkRepo;
    private readonly db;
    private readonly importAttachmentService;
    private moduleRef;
    private eventEmitter;
    private readonly auditService;
    private readonly logger;
    constructor(storageService: StorageService, importService: ImportService, pageService: PageService, backlinkRepo: BacklinkRepo, db: KyselyDB, importAttachmentService: ImportAttachmentService, moduleRef: ModuleRef, eventEmitter: EventEmitter2, auditService: IAuditService);
    processZIpImport(fileTaskId: string): Promise<void>;
    processGenericImport(opts: {
        extractDir: string;
        fileTask: FileTask;
    }): Promise<void>;
    getFileTask(fileTaskId: string): Promise<{
        type: string;
        id: string;
        workspaceId: string;
        creatorId: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        metadata: import("../../../database/types/db").JsonValue;
        status: string;
        spaceId: string;
        pageId: string;
        fileExt: string;
        fileName: string;
        filePath: string;
        fileSize: string;
        errorMessage: string;
        source: string;
    }>;
    updateTaskStatus(fileTaskId: string, status: FileTaskStatus, errorMessage?: string): Promise<void>;
}
