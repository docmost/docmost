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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsService = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const page_permission_repo_1 = require("../database/repos/page/page-permission.repo");
const ws_utils_1 = require("./ws.utils");
let WsService = class WsService {
    constructor(pagePermissionRepo, cacheManager) {
        this.pagePermissionRepo = pagePermissionRepo;
        this.cacheManager = cacheManager;
    }
    setServer(server) {
        this.server = server;
    }
    async handleTreeEvent(client, data) {
        const room = (0, ws_utils_1.getSpaceRoomName)(data.spaceId);
        if (!client.rooms.has(room)) {
            return;
        }
        if (data.operation === 'refetchRootTreeNodeEvent') {
            client.broadcast.to(room).emit('message', data);
            return;
        }
        const hasRestrictions = await this.spaceHasRestrictions(data.spaceId);
        if (!hasRestrictions) {
            client.broadcast.to(room).emit('message', data);
            return;
        }
        const pageId = this.extractPageId(data);
        if (!pageId) {
            return;
        }
        const isRestricted = await this.pagePermissionRepo.hasRestrictedAncestor(pageId);
        if (!isRestricted) {
            client.broadcast.to(room).emit('message', data);
            return;
        }
        await this.broadcastToAuthorizedUsers(room, client.id, pageId, data);
    }
    async invalidateSpaceRestrictionCache(spaceId) {
        await this.cacheManager.del(`${ws_utils_1.WS_SPACE_RESTRICTION_CACHE_PREFIX}${spaceId}`);
    }
    async emitCommentEvent(spaceId, pageId, data) {
        const room = (0, ws_utils_1.getSpaceRoomName)(spaceId);
        const hasRestrictions = await this.spaceHasRestrictions(spaceId);
        if (!hasRestrictions) {
            this.server.to(room).emit('message', data);
            return;
        }
        const isRestricted = await this.pagePermissionRepo.hasRestrictedAncestor(pageId);
        if (!isRestricted) {
            this.server.to(room).emit('message', data);
            return;
        }
        await this.broadcastToAuthorizedUsers(room, null, pageId, data);
    }
    async emitToUsers(userIds, data) {
        if (userIds.length === 0)
            return;
        const rooms = userIds.map((id) => (0, ws_utils_1.getUserRoomName)(id));
        this.server.to(rooms).emit('message', data);
    }
    async emitToSpaceExceptUsers(spaceId, excludeUserIds, data) {
        const room = (0, ws_utils_1.getSpaceRoomName)(spaceId);
        const sockets = await this.server.in(room).fetchSockets();
        const excludeSet = new Set(excludeUserIds);
        for (const socket of sockets) {
            const userId = socket.data.userId;
            if (userId && !excludeSet.has(userId)) {
                socket.emit('message', data);
            }
        }
    }
    isTreeEvent(data) {
        return ws_utils_1.TREE_EVENTS.has(data?.operation) && !!data?.spaceId;
    }
    async broadcastToAuthorizedUsers(room, excludeSocketId, pageId, data) {
        const sockets = await this.server.in(room).fetchSockets();
        const otherSockets = excludeSocketId
            ? sockets.filter((s) => s.id !== excludeSocketId)
            : sockets;
        if (otherSockets.length === 0)
            return;
        const userSocketMap = new Map();
        for (const socket of otherSockets) {
            const userId = socket.data.userId;
            if (!userId)
                continue;
            const existing = userSocketMap.get(userId);
            if (existing) {
                existing.push(socket);
            }
            else {
                userSocketMap.set(userId, [socket]);
            }
        }
        const candidateUserIds = Array.from(userSocketMap.keys());
        if (candidateUserIds.length === 0)
            return;
        const authorizedUserIds = await this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, candidateUserIds);
        const authorizedSet = new Set(authorizedUserIds);
        for (const [userId, userSockets] of userSocketMap) {
            if (authorizedSet.has(userId)) {
                for (const socket of userSockets) {
                    socket.emit('message', data);
                }
            }
        }
    }
    async spaceHasRestrictions(spaceId) {
        const cacheKey = `${ws_utils_1.WS_SPACE_RESTRICTION_CACHE_PREFIX}${spaceId}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached !== undefined && cached !== null) {
            return cached;
        }
        const hasRestrictions = await this.pagePermissionRepo.hasRestrictedPagesInSpace(spaceId);
        await this.cacheManager.set(cacheKey, hasRestrictions, ws_utils_1.WS_CACHE_TTL_MS);
        return hasRestrictions;
    }
    extractPageId(data) {
        switch (data.operation) {
            case 'addTreeNode':
                return data.payload?.data?.id ?? null;
            case 'moveTreeNode':
                return data.payload?.id ?? null;
            case 'deleteTreeNode':
                return data.payload?.node?.id ?? null;
            case 'updateOne':
                return data.id ?? null;
            default:
                return null;
        }
    }
};
exports.WsService = WsService;
exports.WsService = WsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [page_permission_repo_1.PagePermissionRepo, Object])
], WsService);
//# sourceMappingURL=ws.service.js.map