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
exports.BacklinkService = void 0;
const common_1 = require("@nestjs/common");
const backlink_repo_1 = require("../../../database/repos/backlink/backlink.repo");
const page_permission_repo_1 = require("../../../database/repos/page/page-permission.repo");
let BacklinkService = class BacklinkService {
    constructor(backlinkRepo, pagePermissionRepo) {
        this.backlinkRepo = backlinkRepo;
        this.pagePermissionRepo = pagePermissionRepo;
    }
    async countByPageId(pageId, userId) {
        const [incomingIds, outgoingIds] = await Promise.all([
            this.accessibleRelatedIds(pageId, 'incoming', userId),
            this.accessibleRelatedIds(pageId, 'outgoing', userId),
        ]);
        return { incoming: incomingIds.length, outgoing: outgoingIds.length };
    }
    async findByPageId(pageId, direction, userId, pagination) {
        const accessibleIds = await this.accessibleRelatedIds(pageId, direction, userId);
        return this.backlinkRepo.findPagesByIdsPaginated(accessibleIds, pagination);
    }
    async accessibleRelatedIds(pageId, direction, userId) {
        const candidateIds = await this.backlinkRepo.findRelatedPageIds(pageId, direction, userId);
        if (candidateIds.length === 0)
            return [];
        return this.pagePermissionRepo.filterAccessiblePageIds({
            pageIds: candidateIds,
            userId,
        });
    }
};
exports.BacklinkService = BacklinkService;
exports.BacklinkService = BacklinkService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [backlink_repo_1.BacklinkRepo,
        page_permission_repo_1.PagePermissionRepo])
], BacklinkService);
//# sourceMappingURL=backlink.service.js.map