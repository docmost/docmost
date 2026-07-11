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
exports.WatcherService = void 0;
const common_1 = require("@nestjs/common");
const watcher_repo_1 = require("../../database/repos/watcher/watcher.repo");
const space_member_repo_1 = require("../../database/repos/space/space-member.repo");
let WatcherService = class WatcherService {
    constructor(watcherRepo, spaceMemberRepo) {
        this.watcherRepo = watcherRepo;
        this.spaceMemberRepo = spaceMemberRepo;
    }
    async watchPage(userId, pageId, spaceId, workspaceId, trx) {
        const watcher = {
            userId,
            pageId,
            spaceId,
            workspaceId,
            type: watcher_repo_1.WatcherType.PAGE,
            addedById: userId,
        };
        return this.watcherRepo.upsert(watcher, trx);
    }
    async addPageWatchers(userIds, pageId, spaceId, workspaceId, trx) {
        if (userIds.length === 0)
            return;
        const watchers = userIds.map((userId) => ({
            userId,
            pageId,
            spaceId,
            workspaceId,
            type: watcher_repo_1.WatcherType.PAGE,
            addedById: userId,
        }));
        return this.watcherRepo.insertMany(watchers, trx);
    }
    async unwatchPage(userId, pageId, spaceId, workspaceId) {
        return this.watcherRepo.mute(userId, pageId, spaceId, workspaceId);
    }
    async isWatchingPage(userId, pageId) {
        return this.watcherRepo.isWatching(userId, pageId);
    }
    async watchSpace(userId, spaceId, workspaceId, trx) {
        const watcher = {
            userId,
            pageId: null,
            spaceId,
            workspaceId,
            type: watcher_repo_1.WatcherType.SPACE,
            addedById: userId,
        };
        return this.watcherRepo.upsertSpace(watcher, trx);
    }
    async unwatchSpace(userId, spaceId) {
        return this.watcherRepo.deleteSpaceWatch(userId, spaceId);
    }
    async getWatchedSpaceIds(userId, workspaceId) {
        const result = await this.watcherRepo.getWatchedSpaceIds(userId, workspaceId);
        const spaceIds = result.items.map((r) => r.spaceId);
        if (spaceIds.length === 0) {
            return { items: spaceIds, meta: result.meta };
        }
        const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
        const spaceSet = new Set(userSpaceIds);
        return {
            items: spaceIds.filter((id) => spaceSet.has(id)),
            meta: result.meta,
        };
    }
    async isWatchingSpace(userId, spaceId) {
        return this.watcherRepo.isWatchingSpace(userId, spaceId);
    }
    async getPageWatchers(pageId, pagination) {
        return this.watcherRepo.findPageWatchers(pageId, pagination);
    }
    async getPageWatcherIds(pageId, trx) {
        return this.watcherRepo.getPageWatcherIds(pageId, trx);
    }
    async countPageWatchers(pageId) {
        return this.watcherRepo.countPageWatchers(pageId);
    }
    async cleanupOnSpaceAccessChange(userIds, spaceId, opts) {
        const { trx } = opts;
        await this.watcherRepo.deleteByUsersWithoutSpaceAccess(userIds, spaceId, {
            trx,
        });
    }
    async movePageWatchersToSpace(pageIds, spaceId, opts) {
        await this.watcherRepo.updateSpaceIdByPageIds(spaceId, pageIds, opts);
        await this.watcherRepo.deleteByPageIdsWithoutSpaceAccess(pageIds, spaceId, opts);
    }
};
exports.WatcherService = WatcherService;
exports.WatcherService = WatcherService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [watcher_repo_1.WatcherRepo,
        space_member_repo_1.SpaceMemberRepo])
], WatcherService);
//# sourceMappingURL=watcher.service.js.map