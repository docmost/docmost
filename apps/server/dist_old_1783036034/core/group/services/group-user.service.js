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
exports.GroupUserService = void 0;
const common_1 = require("@nestjs/common");
const group_service_1 = require("./group.service");
const nestjs_kysely_1 = require("nestjs-kysely");
const group_user_repo_1 = require("../../../database/repos/group/group-user.repo");
const space_member_repo_1 = require("../../../database/repos/space/space-member.repo");
const user_repo_1 = require("../../../database/repos/user/user.repo");
const utils_1 = require("../../../database/utils");
const watcher_repo_1 = require("../../../database/repos/watcher/watcher.repo");
const favorite_repo_1 = require("../../../database/repos/favorite/favorite.repo");
const audit_events_1 = require("../../../common/events/audit-events");
const audit_service_1 = require("../../../integrations/audit/audit.service");
const utils_2 = require("../../../database/utils");
let GroupUserService = class GroupUserService {
    constructor(groupUserRepo, spaceMemberRepo, userRepo, groupService, watcherRepo, favoriteRepo, db, auditService) {
        this.groupUserRepo = groupUserRepo;
        this.spaceMemberRepo = spaceMemberRepo;
        this.userRepo = userRepo;
        this.groupService = groupService;
        this.watcherRepo = watcherRepo;
        this.favoriteRepo = favoriteRepo;
        this.db = db;
        this.auditService = auditService;
    }
    async getGroupUsers(groupId, workspaceId, pagination) {
        await this.groupService.findAndValidateGroup(groupId, workspaceId);
        const groupUsers = await this.groupUserRepo.getGroupUsersPaginated(groupId, pagination);
        return groupUsers;
    }
    async addUsersToGroupBatch(userIds, groupId, workspaceId, trx) {
        const db = (0, utils_2.dbOrTx)(this.db, trx);
        await this.groupService.findAndValidateGroup(groupId, workspaceId, trx);
        if (userIds.length === 0)
            return;
        const validUsers = await db
            .selectFrom('users')
            .select(['id', 'name'])
            .where('users.id', 'in', userIds)
            .where('users.workspaceId', '=', workspaceId)
            .execute();
        if (validUsers.length === 0)
            return;
        const groupUsersToInsert = [];
        for (const user of validUsers) {
            groupUsersToInsert.push({
                userId: user.id,
                groupId: groupId,
            });
        }
        await db
            .insertInto('groupUsers')
            .values(groupUsersToInsert)
            .onConflict((oc) => oc.columns(['userId', 'groupId']).doNothing())
            .execute();
        for (const user of validUsers) {
            this.auditService.log({
                event: audit_events_1.AuditEvent.GROUP_MEMBER_ADDED,
                resourceType: audit_events_1.AuditResource.GROUP,
                resourceId: groupId,
                changes: {
                    after: {
                        userId: user.id,
                        userName: user.name,
                    },
                },
            });
        }
    }
    async removeUserFromGroup(userId, groupId, workspaceId) {
        const group = await this.groupService.findAndValidateGroup(groupId, workspaceId);
        const user = await this.userRepo.findById(userId, workspaceId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (group.isDefault) {
            throw new common_1.BadRequestException('You cannot remove users from a default group');
        }
        const groupUser = await this.groupUserRepo.getGroupUserById(userId, groupId);
        if (!groupUser) {
            throw new common_1.BadRequestException('Group member not found');
        }
        const spaceIds = await this.spaceMemberRepo.getSpaceIdsByGroupId(groupId);
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            await this.groupUserRepo.delete(userId, groupId, { trx });
            for (const spaceId of spaceIds) {
                await this.watcherRepo.deleteByUsersWithoutSpaceAccess([userId], spaceId, { trx });
                await this.favoriteRepo.deleteByUsersWithoutSpaceAccess([userId], spaceId, { trx });
            }
        });
        this.auditService.log({
            event: audit_events_1.AuditEvent.GROUP_MEMBER_REMOVED,
            resourceType: audit_events_1.AuditResource.GROUP,
            resourceId: groupId,
            changes: {
                before: {
                    userId: user.id,
                    userName: user.name,
                },
            },
            metadata: {
                groupName: group.name,
            },
        });
    }
};
exports.GroupUserService = GroupUserService;
exports.GroupUserService = GroupUserService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => group_service_1.GroupService))),
    __param(6, (0, nestjs_kysely_1.InjectKysely)()),
    __param(7, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [group_user_repo_1.GroupUserRepo,
        space_member_repo_1.SpaceMemberRepo,
        user_repo_1.UserRepo,
        group_service_1.GroupService,
        watcher_repo_1.WatcherRepo,
        favorite_repo_1.FavoriteRepo, Object, Object])
], GroupUserService);
//# sourceMappingURL=group-user.service.js.map