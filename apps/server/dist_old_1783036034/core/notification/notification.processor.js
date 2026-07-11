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
var NotificationProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationProcessor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const nestjs_kysely_1 = require("nestjs-kysely");
const constants_1 = require("../../integrations/queue/constants");
const comment_notification_1 = require("./services/comment.notification");
const page_notification_1 = require("./services/page.notification");
const verification_notification_1 = require("./services/verification.notification");
const domain_service_1 = require("../../integrations/environment/domain.service");
let NotificationProcessor = NotificationProcessor_1 = class NotificationProcessor extends bullmq_1.WorkerHost {
    constructor(commentNotificationService, pageNotificationService, verificationNotificationService, domainService, moduleRef, db) {
        super();
        this.commentNotificationService = commentNotificationService;
        this.pageNotificationService = pageNotificationService;
        this.verificationNotificationService = verificationNotificationService;
        this.domainService = domainService;
        this.moduleRef = moduleRef;
        this.db = db;
        this.logger = new common_1.Logger(NotificationProcessor_1.name);
    }
    async process(job) {
        try {
            if (job.name === constants_1.QueueJob.VERIFICATION_RECONCILE) {
                await this.runVerificationReconcile();
                return;
            }
            const workspaceId = await this.resolveWorkspaceId(job);
            const appUrl = await this.getWorkspaceUrl(workspaceId);
            switch (job.name) {
                case constants_1.QueueJob.COMMENT_NOTIFICATION: {
                    await this.commentNotificationService.processComment(job.data, appUrl);
                    break;
                }
                case constants_1.QueueJob.COMMENT_RESOLVED_NOTIFICATION: {
                    await this.commentNotificationService.processResolved(job.data, appUrl);
                    break;
                }
                case constants_1.QueueJob.PAGE_MENTION_NOTIFICATION: {
                    await this.pageNotificationService.processPageMention(job.data, appUrl);
                    break;
                }
                case constants_1.QueueJob.PAGE_PERMISSION_GRANTED: {
                    await this.pageNotificationService.processPermissionGranted(job.data, appUrl);
                    break;
                }
                case constants_1.QueueJob.PAGE_UPDATED: {
                    await this.pageNotificationService.processPageUpdate(job.data, appUrl);
                    break;
                }
                case constants_1.QueueJob.PAGE_UPDATE_DIGEST: {
                    const { userId } = job.data;
                    await this.pageNotificationService.processDigest(userId, appUrl);
                    break;
                }
                case constants_1.QueueJob.PAGE_VERIFICATION_EXPIRING: {
                    await this.verificationNotificationService.processVerificationExpiring(job.data, appUrl);
                    break;
                }
                case constants_1.QueueJob.PAGE_VERIFICATION_EXPIRED: {
                    await this.verificationNotificationService.processVerificationExpired(job.data, appUrl);
                    break;
                }
                case constants_1.QueueJob.PAGE_VERIFIED_NOTIFICATION: {
                    await this.verificationNotificationService.processPageVerified(job.data);
                    break;
                }
                case constants_1.QueueJob.PAGE_APPROVAL_REQUESTED_NOTIFICATION: {
                    await this.verificationNotificationService.processApprovalRequested(job.data, appUrl);
                    break;
                }
                case constants_1.QueueJob.PAGE_APPROVAL_REJECTED_NOTIFICATION: {
                    await this.verificationNotificationService.processApprovalRejected(job.data, appUrl);
                    break;
                }
                default:
                    this.logger.warn(`Unknown notification job: ${job.name}`);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Failed to process ${job.name}: ${message}`);
            throw err;
        }
    }
    async resolveWorkspaceId(job) {
        if (job.name === constants_1.QueueJob.PAGE_VERIFICATION_EXPIRING ||
            job.name === constants_1.QueueJob.PAGE_VERIFICATION_EXPIRED) {
            const { verificationId } = job.data;
            const row = await this.db
                .selectFrom('pageVerifications')
                .select('workspaceId')
                .where('id', '=', verificationId)
                .executeTakeFirst();
            return row?.workspaceId ?? '';
        }
        return job.data.workspaceId;
    }
    async runVerificationReconcile() {
        let eeModule;
        try {
            eeModule = require('../../ee/page-verification/page-verification-scheduler.service');
        }
        catch {
            this.logger.debug('VERIFICATION_RECONCILE fired but EE scheduler not bundled in this build');
            return;
        }
        const schedulerClass = eeModule.PageVerificationSchedulerService;
        if (!schedulerClass)
            return;
        const scheduler = this.moduleRef.get(schedulerClass, { strict: false });
        if (!scheduler) {
            this.logger.warn('VERIFICATION_RECONCILE fired but scheduler service not resolvable');
            return;
        }
        await scheduler.reconcile();
    }
    async getWorkspaceUrl(workspaceId) {
        const workspace = await this.db
            .selectFrom('workspaces')
            .select('hostname')
            .where('id', '=', workspaceId)
            .executeTakeFirst();
        return this.domainService.getUrl(workspace?.hostname);
    }
    onError(job) {
        this.logger.error(`Error processing ${job.name} job. Reason: ${job.failedReason}`);
    }
    async onModuleDestroy() {
        if (this.worker) {
            await this.worker.close();
        }
    }
};
exports.NotificationProcessor = NotificationProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], NotificationProcessor.prototype, "onError", null);
exports.NotificationProcessor = NotificationProcessor = NotificationProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(constants_1.QueueName.NOTIFICATION_QUEUE),
    __param(5, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [comment_notification_1.CommentNotificationService,
        page_notification_1.PageNotificationService,
        verification_notification_1.VerificationNotificationService,
        domain_service_1.DomainService,
        core_1.ModuleRef, Object])
], NotificationProcessor);
//# sourceMappingURL=notification.processor.js.map