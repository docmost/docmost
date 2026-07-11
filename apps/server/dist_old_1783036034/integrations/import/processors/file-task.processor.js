"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var FileTaskProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTaskProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const constants_1 = require("../../queue/constants");
const file_import_task_service_1 = require("../services/file-import-task.service");
const file_utils_1 = require("../utils/file.utils");
const storage_service_1 = require("../../storage/storage.service");
const core_1 = require("@nestjs/core");
const nestjs_kysely_1 = require("nestjs-kysely");
let FileTaskProcessor = FileTaskProcessor_1 = class FileTaskProcessor extends bullmq_1.WorkerHost {
    constructor(fileTaskService, storageService, moduleRef, db) {
        super();
        this.fileTaskService = fileTaskService;
        this.storageService = storageService;
        this.moduleRef = moduleRef;
        this.db = db;
        this.logger = new common_1.Logger(FileTaskProcessor_1.name);
    }
    async process(job) {
        try {
            switch (job.name) {
                case constants_1.QueueJob.IMPORT_TASK:
                    await this.fileTaskService.processZIpImport(job.data.fileTaskId);
                    break;
                case constants_1.QueueJob.PDF_EXPORT_TASK:
                    await this.processExportTask(job.data.fileTaskId);
                    break;
                case constants_1.QueueJob.PDF_EXPORT_CLEANUP:
                    await this.processExportCleanup();
                    break;
            }
        }
        catch (err) {
            this.logger.error('File task failed', err);
            throw err;
        }
    }
    getPdfExportService() {
        const PdfExportModule = require('./../../../ee/pdf-export/pdf-export.service');
        return this.moduleRef.get(PdfExportModule.PdfExportService, {
            strict: false,
        });
    }
    async processExportTask(fileTaskId) {
        const pdfExportService = this.getPdfExportService();
        await pdfExportService.generateAndStorePdf(fileTaskId);
    }
    async processExportCleanup() {
        const pdfExportService = this.getPdfExportService();
        await pdfExportService.cleanupExpiredExports();
    }
    onActive(job) {
        this.logger.debug(`Processing ${job.name} job`);
    }
    async onFailed(job) {
        const fileTaskId = job.data?.fileTaskId;
        this.logger.error(fileTaskId
            ? `Error processing ${job.name} job. File Task ID: ${fileTaskId}. Reason: ${job.failedReason}`
            : `Error processing ${job.name} job. Reason: ${job.failedReason}`);
        if (job.name === constants_1.QueueJob.IMPORT_TASK) {
            await this.handleFailedImportJob(job);
        }
        else if (job.name === constants_1.QueueJob.PDF_EXPORT_TASK) {
            await this.handleFailedExportJob(job);
        }
    }
    async onCompleted(job) {
        const fileTaskId = job.data?.fileTaskId;
        this.logger.log(fileTaskId
            ? `Completed ${job.name} job for File task ID ${fileTaskId}`
            : `Completed ${job.name} job`);
        if (job.name === constants_1.QueueJob.IMPORT_TASK) {
            try {
                const fileTask = await this.fileTaskService.getFileTask(job.data.fileTaskId);
                if (fileTask) {
                    await this.storageService.delete(fileTask.filePath);
                    this.logger.debug(`Deleted imported zip file: ${fileTask.filePath}`);
                }
            }
            catch (err) {
                this.logger.error(`Failed to delete imported zip file:`, err);
            }
        }
    }
    async handleFailedImportJob(job) {
        try {
            const fileTaskId = job.data.fileTaskId;
            const reason = job.failedReason || 'Unknown error';
            await this.fileTaskService.updateTaskStatus(fileTaskId, file_utils_1.FileTaskStatus.Failed, reason);
            const fileTask = await this.fileTaskService.getFileTask(fileTaskId);
            if (fileTask) {
                await this.storageService.delete(fileTask.filePath);
            }
        }
        catch (err) {
            this.logger.error(err);
        }
    }
    async handleFailedExportJob(job) {
        try {
            const fileTaskId = job.data.fileTaskId;
            const reason = job.failedReason || 'Unknown error';
            await this.db
                .updateTable('fileTasks')
                .set({
                status: file_utils_1.FileTaskStatus.Failed,
                errorMessage: reason,
                updatedAt: new Date(),
            })
                .where('id', '=', fileTaskId)
                .execute();
        }
        catch (err) {
            this.logger.error(err);
        }
    }
    async onModuleDestroy() {
        if (this.worker) {
            await this.worker.close();
        }
    }
};
exports.FileTaskProcessor = FileTaskProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], FileTaskProcessor.prototype, "onActive", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", Promise)
], FileTaskProcessor.prototype, "onFailed", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", Promise)
], FileTaskProcessor.prototype, "onCompleted", null);
exports.FileTaskProcessor = FileTaskProcessor = FileTaskProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(constants_1.QueueName.FILE_TASK_QUEUE),
    __param(3, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [file_import_task_service_1.FileImportTaskService,
        storage_service_1.StorageService,
        core_1.ModuleRef, Object])
], FileTaskProcessor);
//# sourceMappingURL=file-task.processor.js.map