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
var AttachmentProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const attachment_service_1 = require("../services/attachment.service");
const constants_1 = require("../../../integrations/queue/constants");
const core_1 = require("@nestjs/core");
let AttachmentProcessor = AttachmentProcessor_1 = class AttachmentProcessor extends bullmq_1.WorkerHost {
    constructor(attachmentService, moduleRef) {
        super();
        this.attachmentService = attachmentService;
        this.moduleRef = moduleRef;
        this.logger = new common_1.Logger(AttachmentProcessor_1.name);
    }
    async process(job) {
        try {
            if (job.name === constants_1.QueueJob.DELETE_SPACE_ATTACHMENTS) {
                await this.attachmentService.handleDeleteSpaceAttachments(job.data.id);
            }
            if (job.name === constants_1.QueueJob.DELETE_USER_AVATARS) {
                await this.attachmentService.handleDeleteUserAvatars(job.data.id);
            }
            if (job.name === constants_1.QueueJob.DELETE_PAGE_ATTACHMENTS) {
                await this.attachmentService.handleDeletePageAttachments(job.data.pageId);
            }
            if (job.name === constants_1.QueueJob.DELETE_AI_CHAT_ATTACHMENTS) {
                await this.attachmentService.handleDeleteAiChatAttachments(job.data.aiChatId);
            }
            if (job.name === constants_1.QueueJob.ATTACHMENT_INDEX_CONTENT ||
                job.name === constants_1.QueueJob.ATTACHMENT_INDEXING) {
                let AttachmentEeModule;
                try {
                    AttachmentEeModule = require('./../../../ee/attachments-ee/attachment-ee.service');
                }
                catch (err) {
                    this.logger.debug('Attachment enterprise module requested but EE module not bundled in this build');
                    return;
                }
                const attachmentEeService = this.moduleRef.get(AttachmentEeModule.AttachmentEeService, { strict: false });
                if (job.name === constants_1.QueueJob.ATTACHMENT_INDEX_CONTENT) {
                    await attachmentEeService.indexAttachment(job.data.attachmentId);
                }
                else if (job.name === constants_1.QueueJob.ATTACHMENT_INDEXING) {
                    await attachmentEeService.indexAttachments(job.data.workspaceId);
                }
            }
        }
        catch (err) {
            throw err;
        }
    }
    onActive(job) {
        this.logger.debug(`Processing ${job.name} job`);
    }
    onError(job) {
        if (job.name === constants_1.QueueJob.ATTACHMENT_INDEX_CONTENT) {
            this.logger.debug(`Error processing ${job.name} job for attachment ${job.data?.attachmentId}. Reason: ${job.failedReason}`);
        }
        else {
            this.logger.error(`Error processing ${job.name} job. Reason: ${job.failedReason}`);
        }
    }
    onCompleted(job) {
        this.logger.debug(`Completed ${job.name} job`);
    }
    async onModuleDestroy() {
        if (this.worker) {
            await this.worker.close();
        }
    }
};
exports.AttachmentProcessor = AttachmentProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], AttachmentProcessor.prototype, "onActive", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], AttachmentProcessor.prototype, "onError", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], AttachmentProcessor.prototype, "onCompleted", null);
exports.AttachmentProcessor = AttachmentProcessor = AttachmentProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(constants_1.QueueName.ATTACHMENT_QUEUE),
    __metadata("design:paramtypes", [attachment_service_1.AttachmentService,
        core_1.ModuleRef])
], AttachmentProcessor);
//# sourceMappingURL=attachment.processor.js.map