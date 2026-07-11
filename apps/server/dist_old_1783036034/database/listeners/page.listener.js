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
var PageListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageListener = exports.PageEvent = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const event_contants_1 = require("../../common/events/event.contants");
const bullmq_1 = require("@nestjs/bullmq");
const constants_1 = require("../../integrations/queue/constants");
const bullmq_2 = require("bullmq");
const environment_service_1 = require("../../integrations/environment/environment.service");
class PageEvent {
}
exports.PageEvent = PageEvent;
let PageListener = PageListener_1 = class PageListener {
    constructor(environmentService, searchQueue, aiQueue) {
        this.environmentService = environmentService;
        this.searchQueue = searchQueue;
        this.aiQueue = aiQueue;
        this.logger = new common_1.Logger(PageListener_1.name);
    }
    async handlePageCreated(event) {
        const { pageIds, workspaceId } = event;
        if (this.isTypesense()) {
            await this.searchQueue.add(constants_1.QueueJob.PAGE_CREATED, {
                pageIds,
            });
        }
        await this.aiQueue.add(constants_1.QueueJob.PAGE_CREATED, { pageIds, workspaceId });
    }
    async handlePageUpdated(event) {
        const { pageIds } = event;
        await this.searchQueue.add(constants_1.QueueJob.PAGE_UPDATED, { pageIds });
    }
    async handlePageDeleted(event) {
        const { pageIds, workspaceId } = event;
        if (this.isTypesense()) {
            await this.searchQueue.add(constants_1.QueueJob.PAGE_DELETED, { pageIds });
        }
        await this.aiQueue.add(constants_1.QueueJob.PAGE_DELETED, { pageIds, workspaceId });
    }
    async handlePageSoftDeleted(event) {
        const { pageIds, workspaceId } = event;
        if (this.isTypesense()) {
            await this.searchQueue.add(constants_1.QueueJob.PAGE_SOFT_DELETED, { pageIds });
        }
        await this.aiQueue.add(constants_1.QueueJob.PAGE_SOFT_DELETED, {
            pageIds,
            workspaceId,
        });
    }
    async handlePageRestored(event) {
        const { pageIds, workspaceId } = event;
        if (this.isTypesense()) {
            await this.searchQueue.add(constants_1.QueueJob.PAGE_RESTORED, { pageIds });
        }
        await this.aiQueue.add(constants_1.QueueJob.PAGE_RESTORED, { pageIds, workspaceId });
    }
    isTypesense() {
        return this.environmentService.getSearchDriver() === 'typesense';
    }
};
exports.PageListener = PageListener;
__decorate([
    (0, event_emitter_1.OnEvent)(event_contants_1.EventName.PAGE_CREATED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PageEvent]),
    __metadata("design:returntype", Promise)
], PageListener.prototype, "handlePageCreated", null);
__decorate([
    (0, event_emitter_1.OnEvent)(event_contants_1.EventName.PAGE_UPDATED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PageEvent]),
    __metadata("design:returntype", Promise)
], PageListener.prototype, "handlePageUpdated", null);
__decorate([
    (0, event_emitter_1.OnEvent)(event_contants_1.EventName.PAGE_DELETED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PageEvent]),
    __metadata("design:returntype", Promise)
], PageListener.prototype, "handlePageDeleted", null);
__decorate([
    (0, event_emitter_1.OnEvent)(event_contants_1.EventName.PAGE_SOFT_DELETED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PageEvent]),
    __metadata("design:returntype", Promise)
], PageListener.prototype, "handlePageSoftDeleted", null);
__decorate([
    (0, event_emitter_1.OnEvent)(event_contants_1.EventName.PAGE_RESTORED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PageEvent]),
    __metadata("design:returntype", Promise)
], PageListener.prototype, "handlePageRestored", null);
exports.PageListener = PageListener = PageListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, bullmq_1.InjectQueue)(constants_1.QueueName.SEARCH_QUEUE)),
    __param(2, (0, bullmq_1.InjectQueue)(constants_1.QueueName.AI_QUEUE)),
    __metadata("design:paramtypes", [environment_service_1.EnvironmentService,
        bullmq_2.Queue,
        bullmq_2.Queue])
], PageListener);
//# sourceMappingURL=page.listener.js.map