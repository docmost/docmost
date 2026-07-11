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
var TrashCleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrashCleanupService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const nestjs_kysely_1 = require("nestjs-kysely");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const constants_1 = require("../../../integrations/queue/constants");
const DEFAULT_RETENTION_DAYS = 30;
let TrashCleanupService = TrashCleanupService_1 = class TrashCleanupService {
    constructor(db, attachmentQueue) {
        this.db = db;
        this.attachmentQueue = attachmentQueue;
        this.logger = new common_1.Logger(TrashCleanupService_1.name);
    }
    async cleanupOldTrash() {
        try {
            this.logger.debug('Starting trash cleanup job');
            const workspaces = await this.db
                .selectFrom('workspaces')
                .select(['id', 'trashRetentionDays'])
                .where('deletedAt', 'is', null)
                .execute();
            let totalCleaned = 0;
            for (const workspace of workspaces) {
                const retentionDays = workspace.trashRetentionDays ?? DEFAULT_RETENTION_DAYS;
                const retentionDate = new Date();
                retentionDate.setDate(retentionDate.getDate() - retentionDays);
                const oldDeletedPages = await this.db
                    .selectFrom('pages')
                    .select(['id'])
                    .where('workspaceId', '=', workspace.id)
                    .where('deletedAt', '<', retentionDate)
                    .execute();
                for (const page of oldDeletedPages) {
                    try {
                        await this.cleanupPage(page.id);
                        totalCleaned++;
                    }
                    catch (error) {
                        this.logger.error(`Failed to cleanup page ${page.id}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
                    }
                }
            }
            this.logger.debug(totalCleaned > 0
                ? `Trash cleanup completed: ${totalCleaned} pages cleaned`
                : 'No old trash items to clean up');
        }
        catch (error) {
            this.logger.error('Trash cleanup job failed', error instanceof Error ? error.stack : undefined);
        }
    }
    async cleanupPage(pageId) {
        const descendants = await this.db
            .withRecursive('page_descendants', (db) => db
            .selectFrom('pages')
            .select(['id'])
            .where('id', '=', pageId)
            .unionAll((exp) => exp
            .selectFrom('pages as p')
            .select(['p.id'])
            .innerJoin('page_descendants as pd', 'pd.id', 'p.parentPageId')))
            .selectFrom('page_descendants')
            .selectAll()
            .execute();
        const pageIds = descendants.map((d) => d.id);
        this.logger.debug(`Cleaning up page ${pageId} with ${pageIds.length - 1} descendants`);
        for (const id of pageIds) {
            await this.attachmentQueue.add(constants_1.QueueJob.DELETE_PAGE_ATTACHMENTS, {
                pageId: id,
            }, {
                jobId: `delete-page-attachments-${id}`,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            });
        }
        try {
            if (pageIds.length > 0) {
                await this.db.deleteFrom('pages').where('id', 'in', pageIds).execute();
            }
        }
        catch (error) {
            this.logger.warn(`Error deleting pages, they may have been already deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
};
exports.TrashCleanupService = TrashCleanupService;
__decorate([
    (0, schedule_1.Interval)('trash-cleanup', 24 * 60 * 60 * 1000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TrashCleanupService.prototype, "cleanupOldTrash", null);
exports.TrashCleanupService = TrashCleanupService = TrashCleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __param(1, (0, bullmq_1.InjectQueue)(constants_1.QueueName.ATTACHMENT_QUEUE)),
    __metadata("design:paramtypes", [Object, bullmq_2.Queue])
], TrashCleanupService);
//# sourceMappingURL=trash-cleanup.service.js.map