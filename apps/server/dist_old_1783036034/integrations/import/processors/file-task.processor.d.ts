import { OnModuleDestroy } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FileImportTaskService } from '../services/file-import-task.service';
import { StorageService } from '../../storage/storage.service';
import { ModuleRef } from '@nestjs/core';
import { KyselyDB } from "../../../database/types/kysely.types";
export declare class FileTaskProcessor extends WorkerHost implements OnModuleDestroy {
    private readonly fileTaskService;
    private readonly storageService;
    private readonly moduleRef;
    private readonly db;
    private readonly logger;
    constructor(fileTaskService: FileImportTaskService, storageService: StorageService, moduleRef: ModuleRef, db: KyselyDB);
    process(job: Job<any, void>): Promise<void>;
    private getPdfExportService;
    private processExportTask;
    private processExportCleanup;
    onActive(job: Job): void;
    onFailed(job: Job): Promise<void>;
    onCompleted(job: Job): Promise<void>;
    private handleFailedImportJob;
    private handleFailedExportJob;
    onModuleDestroy(): Promise<void>;
}
