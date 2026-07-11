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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsTreeService = void 0;
const common_1 = require("@nestjs/common");
const ws_service_1 = require("./ws.service");
let WsTreeService = class WsTreeService {
    constructor(wsService) {
        this.wsService = wsService;
    }
    async notifyPageRestricted(page, excludeUserId) {
        await this.wsService.emitToSpaceExceptUsers(page.spaceId, [excludeUserId], {
            operation: 'deleteTreeNode',
            spaceId: page.spaceId,
            payload: {
                node: {
                    id: page.id,
                    slugId: page.slugId,
                },
            },
        });
    }
    async notifyPermissionGranted(page, userIds) {
        if (userIds.length === 0)
            return;
        await this.wsService.emitToUsers(userIds, {
            operation: 'addTreeNode',
            spaceId: page.spaceId,
            payload: {
                parentId: page.parentPageId ?? null,
                index: 0,
                data: {
                    id: page.id,
                    slugId: page.slugId,
                    name: page.title ?? '',
                    title: page.title,
                    icon: page.icon,
                    position: page.position,
                    spaceId: page.spaceId,
                    parentPageId: page.parentPageId,
                    creatorId: page.creatorId,
                    hasChildren: false,
                    children: [],
                },
            },
        });
    }
};
exports.WsTreeService = WsTreeService;
exports.WsTreeService = WsTreeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_service_1.WsService])
], WsTreeService);
//# sourceMappingURL=ws-tree.service.js.map