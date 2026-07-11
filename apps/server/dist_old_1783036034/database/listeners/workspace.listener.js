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
var WorkspaceListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceListener = exports.WorkspaceEvent = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const event_contants_1 = require("../../common/events/event.contants");
const bullmq_1 = require("@nestjs/bullmq");
const constants_1 = require("../../integrations/queue/constants");
const bullmq_2 = require("bullmq");
const environment_service_1 = require("../../integrations/environment/environment.service");
class WorkspaceEvent {
}
exports.WorkspaceEvent = WorkspaceEvent;
let WorkspaceListener = WorkspaceListener_1 = class WorkspaceListener {
    constructor(environmentService, searchQueue, aiQueue) {
        this.environmentService = environmentService;
        this.searchQueue = searchQueue;
        this.aiQueue = aiQueue;
        this.logger = new common_1.Logger(WorkspaceListener_1.name);
    }
    async handlePageDeleted(event) {
        const { workspaceId } = event;
        if (this.isTypesense()) {
            await this.searchQueue.add(constants_1.QueueJob.WORKSPACE_DELETED, { workspaceId });
        }
        await this.aiQueue.add(constants_1.QueueJob.WORKSPACE_DELETED, { workspaceId });
    }
    isTypesense() {
        return this.environmentService.getSearchDriver() === 'typesense';
    }
};
exports.WorkspaceListener = WorkspaceListener;
__decorate([
    (0, event_emitter_1.OnEvent)(event_contants_1.EventName.WORKSPACE_DELETED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [WorkspaceEvent]),
    __metadata("design:returntype", Promise)
], WorkspaceListener.prototype, "handlePageDeleted", null);
exports.WorkspaceListener = WorkspaceListener = WorkspaceListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, bullmq_1.InjectQueue)(constants_1.QueueName.SEARCH_QUEUE)),
    __param(2, (0, bullmq_1.InjectQueue)(constants_1.QueueName.AI_QUEUE)),
    __metadata("design:paramtypes", [environment_service_1.EnvironmentService,
        bullmq_2.Queue,
        bullmq_2.Queue])
], WorkspaceListener);
//# sourceMappingURL=workspace.listener.js.map