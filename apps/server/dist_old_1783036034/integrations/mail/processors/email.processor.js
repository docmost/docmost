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
var EmailProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const constants_1 = require("../../queue/constants");
const bullmq_2 = require("bullmq");
const mail_service_1 = require("../mail.service");
const notification_repo_1 = require("../../../database/repos/notification/notification.repo");
let EmailProcessor = EmailProcessor_1 = class EmailProcessor extends bullmq_1.WorkerHost {
    constructor(mailService, notificationRepo) {
        super();
        this.mailService = mailService;
        this.notificationRepo = notificationRepo;
        this.logger = new common_1.Logger(EmailProcessor_1.name);
    }
    async process(job) {
        try {
            await this.mailService.sendEmail(job.data);
        }
        catch (err) {
            throw err;
        }
        if (job.data.notificationId) {
            try {
                await this.notificationRepo.markAsEmailed(job.data.notificationId);
            }
            catch (err) {
                this.logger.warn(`Failed to mark notification ${job.data.notificationId} as emailed`);
            }
        }
    }
    onActive(job) {
        this.logger.debug(`Processing ${job.name} job`);
    }
    onError(job) {
        this.logger.error(`Error processing ${job.name} job. Reason: ${job.failedReason}`);
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
exports.EmailProcessor = EmailProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], EmailProcessor.prototype, "onActive", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], EmailProcessor.prototype, "onError", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], EmailProcessor.prototype, "onCompleted", null);
exports.EmailProcessor = EmailProcessor = EmailProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(constants_1.QueueName.EMAIL_QUEUE),
    __metadata("design:paramtypes", [mail_service_1.MailService,
        notification_repo_1.NotificationRepo])
], EmailProcessor);
//# sourceMappingURL=email.processor.js.map