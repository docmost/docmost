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
var GeneralQueueProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneralQueueProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const constants_1 = require("../constants");
const nestjs_kysely_1 = require("nestjs-kysely");
const backlink_repo_1 = require("../../../database/repos/backlink/backlink.repo");
const watcher_repo_1 = require("../../../database/repos/watcher/watcher.repo");
const backlinks_task_1 = require("../tasks/backlinks.task");
let GeneralQueueProcessor = GeneralQueueProcessor_1 = class GeneralQueueProcessor extends bullmq_1.WorkerHost {
    constructor(db, backlinkRepo, watcherRepo) {
        super();
        this.db = db;
        this.backlinkRepo = backlinkRepo;
        this.watcherRepo = watcherRepo;
        this.logger = new common_1.Logger(GeneralQueueProcessor_1.name);
    }
    async process(job) {
        try {
            switch (job.name) {
                case constants_1.QueueJob.ADD_PAGE_WATCHERS: {
                    const { userIds, pageId, spaceId, workspaceId } = job.data;
                    const watchers = userIds.map((userId) => ({
                        userId,
                        pageId,
                        spaceId,
                        workspaceId,
                        type: watcher_repo_1.WatcherType.PAGE,
                        addedById: userId,
                    }));
                    await this.watcherRepo.insertMany(watchers);
                    break;
                }
                case constants_1.QueueJob.PAGE_BACKLINKS: {
                    await (0, backlinks_task_1.processBacklinks)(this.db, this.backlinkRepo, job.data);
                    break;
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
exports.GeneralQueueProcessor = GeneralQueueProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], GeneralQueueProcessor.prototype, "onActive", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], GeneralQueueProcessor.prototype, "onError", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], GeneralQueueProcessor.prototype, "onCompleted", null);
exports.GeneralQueueProcessor = GeneralQueueProcessor = GeneralQueueProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(constants_1.QueueName.GENERAL_QUEUE),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, backlink_repo_1.BacklinkRepo,
        watcher_repo_1.WatcherRepo])
], GeneralQueueProcessor);
//# sourceMappingURL=general-queue.processor.js.map