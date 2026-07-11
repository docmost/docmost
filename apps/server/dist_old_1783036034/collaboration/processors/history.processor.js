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
var HistoryProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("@nestjs/bullmq");
const bullmq_3 = require("bullmq");
const constants_1 = require("../../integrations/queue/constants");
const utils_1 = require("../../common/helpers/prosemirror/utils");
const page_history_repo_1 = require("../../database/repos/page/page-history.repo");
const page_repo_1 = require("../../database/repos/page/page.repo");
const node_util_1 = require("node:util");
const collab_history_service_1 = require("../services/collab-history.service");
const watcher_service_1 = require("../../core/watcher/watcher.service");
const collaboration_util_1 = require("../collaboration.util");
let HistoryProcessor = HistoryProcessor_1 = class HistoryProcessor extends bullmq_1.WorkerHost {
    constructor(pageHistoryRepo, pageRepo, collabHistory, watcherService, notificationQueue, generalQueue) {
        super();
        this.pageHistoryRepo = pageHistoryRepo;
        this.pageRepo = pageRepo;
        this.collabHistory = collabHistory;
        this.watcherService = watcherService;
        this.notificationQueue = notificationQueue;
        this.generalQueue = generalQueue;
        this.logger = new common_1.Logger(HistoryProcessor_1.name);
    }
    async process(job) {
        if (job.name !== constants_1.QueueJob.PAGE_HISTORY)
            return;
        try {
            const { pageId } = job.data;
            const page = await this.pageRepo.findById(pageId, {
                includeContent: true,
            });
            if (!page) {
                this.logger.warn(`Page ${pageId} not found, skipping history`);
                await this.collabHistory.clearContributors(pageId);
                return;
            }
            const lastHistory = await this.pageHistoryRepo.findPageLastHistory(pageId, { includeContent: true });
            if (!lastHistory && (0, collaboration_util_1.isEmptyParagraphDoc)(page.content)) {
                this.logger.debug(`Skipping first history for page ${pageId}: empty content`);
                await this.collabHistory.clearContributors(pageId);
                return;
            }
            if (!lastHistory ||
                !(0, node_util_1.isDeepStrictEqual)(lastHistory.content, page.content)) {
                const contributorIds = await this.collabHistory.popContributors(pageId);
                try {
                    await this.watcherService.addPageWatchers(contributorIds, pageId, page.spaceId, page.workspaceId);
                    await this.pageHistoryRepo.saveHistory(page, { contributorIds });
                    this.logger.debug(`History created for page: ${pageId}`);
                }
                catch (err) {
                    await this.collabHistory.addContributors(pageId, contributorIds);
                    throw err;
                }
                const mentions = (0, utils_1.extractMentions)(page.content);
                const pageMentions = (0, utils_1.extractPageMentions)(mentions);
                const internalLinkSlugIds = (0, utils_1.extractInternalLinkSlugIds)(page.content);
                await this.generalQueue
                    .add(constants_1.QueueJob.PAGE_BACKLINKS, {
                    pageId,
                    workspaceId: page.workspaceId,
                    mentions: pageMentions,
                    internalLinkSlugIds,
                })
                    .catch((err) => {
                    this.logger.error(`Failed to queue backlinks for ${pageId}: ${err.message}`);
                });
                if (contributorIds.length > 0 && lastHistory?.content) {
                    await this.notificationQueue
                        .add(constants_1.QueueJob.PAGE_UPDATED, {
                        pageId,
                        spaceId: page.spaceId,
                        workspaceId: page.workspaceId,
                        actorIds: contributorIds,
                    })
                        .catch((err) => {
                        this.logger.error(`Failed to queue page update notification for ${pageId}: ${err.message}`);
                    });
                }
            }
        }
        catch (err) {
            throw err;
        }
    }
    onActive(job) {
        this.logger.debug(`Processing ${job.name} for page: ${job.data.pageId}`);
    }
    onError(job) {
        this.logger.error(`Failed ${job.name} for page: ${job.data.pageId}. Reason: ${job.failedReason}`);
    }
    async onModuleDestroy() {
        if (this.worker) {
            await this.worker.close();
        }
    }
};
exports.HistoryProcessor = HistoryProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_3.Job]),
    __metadata("design:returntype", void 0)
], HistoryProcessor.prototype, "onActive", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_3.Job]),
    __metadata("design:returntype", void 0)
], HistoryProcessor.prototype, "onError", null);
exports.HistoryProcessor = HistoryProcessor = HistoryProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(constants_1.QueueName.HISTORY_QUEUE),
    __param(4, (0, bullmq_2.InjectQueue)(constants_1.QueueName.NOTIFICATION_QUEUE)),
    __param(5, (0, bullmq_2.InjectQueue)(constants_1.QueueName.GENERAL_QUEUE)),
    __metadata("design:paramtypes", [page_history_repo_1.PageHistoryRepo,
        page_repo_1.PageRepo,
        collab_history_service_1.CollabHistoryService,
        watcher_service_1.WatcherService,
        bullmq_3.Queue,
        bullmq_3.Queue])
], HistoryProcessor);
//# sourceMappingURL=history.processor.js.map