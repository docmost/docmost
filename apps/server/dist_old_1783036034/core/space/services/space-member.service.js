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
exports.SpaceMemberService = void 0;
const common_1 = require("@nestjs/common");
const space_member_repo_1 = require("../../../database/repos/space/space-member.repo");
const group_user_repo_1 = require("../../../database/repos/group/group-user.repo");
const nestjs_kysely_1 = require("nestjs-kysely");
const space_repo_1 = require("../../../database/repos/space/space.repo");
const permission_1 = require("../../../common/helpers/types/permission");
const watcher_repo_1 = require("../../../database/repos/watcher/watcher.repo");
const favorite_repo_1 = require("../../../database/repos/favorite/favorite.repo");
const utils_1 = require("../../../database/utils");
const audit_events_1 = require("../../../common/events/audit-events");
const audit_service_1 = require("../../../integrations/audit/audit.service");
let SpaceMemberService = class SpaceMemberService {
    constructor(spaceMemberRepo, groupUserRepo, spaceRepo, watcherRepo, favoriteRepo, db, auditService) {
        this.spaceMemberRepo = spaceMemberRepo;
        this.groupUserRepo = groupUserRepo;
        this.spaceRepo = spaceRepo;
        this.watcherRepo = watcherRepo;
        this.favoriteRepo = favoriteRepo;
        this.db = db;
        this.auditService = auditService;
    }
    async addUserToSpace(userId, spaceId, role, workspaceId, trx) {
        await this.spaceMemberRepo.insertSpaceMember({
            userId: userId,
            spaceId: spaceId,
            role: role,
        }, trx);
    }
    async addGroupToSpace(groupId, spaceId, role, workspaceId, trx) {
        await this.spaceMemberRepo.insertSpaceMember({
            groupId: groupId,
            spaceId: spaceId,
            role: role,
        }, trx);
    }
    async getSpaceMembers(spaceId, workspaceId, pagination) {
        const space = await this.spaceRepo.findById(spaceId, workspaceId);
        if (!space) {
            throw new common_1.NotFoundException('Space not found');
        }
        return await this.spaceMemberRepo.getSpaceMembersPaginated(spaceId, pagination);
    }
    async addMembersToSpaceBatch(dto, authUser, workspaceId) {
        const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
        if (!space) {
            throw new common_1.NotFoundException('Space not found');
        }
        const validUsersQuery = this.db
            .selectFrom('users')
            .select(['id', 'name'])
            .where('users.id', 'in', dto.userIds)
            .where('users.workspaceId', '=', workspaceId)
            .where(({ not, exists, selectFrom }) => not(exists(selectFrom('spaceMembers')
            .select('id')
            .whereRef('spaceMembers.userId', '=', 'users.id')
            .where('spaceMembers.spaceId', '=', dto.spaceId))));
        const validGroupsQuery = this.db
            .selectFrom('groups')
            .select(['id', 'name'])
            .where('groups.id', 'in', dto.groupIds)
            .where('groups.workspaceId', '=', workspaceId)
            .where(({ not, exists, selectFrom }) => not(exists(selectFrom('spaceMembers')
            .select('id')
            .whereRef('spaceMembers.groupId', '=', 'groups.id')
            .where('spaceMembers.spaceId', '=', dto.spaceId))));
        let validUsers = [], validGroups = [];
        if (dto.userIds && dto.userIds.length > 0) {
            validUsers = await validUsersQuery.execute();
        }
        if (dto.groupIds && dto.groupIds.length > 0) {
            validGroups = await validGroupsQuery.execute();
        }
        const usersToAdd = [];
        for (const user of validUsers) {
            usersToAdd.push({
                spaceId: dto.spaceId,
                userId: user.id,
                role: dto.role,
                addedById: authUser.id,
            });
        }
        const groupsToAdd = [];
        for (const group of validGroups) {
            groupsToAdd.push({
                spaceId: dto.spaceId,
                groupId: group.id,
                role: dto.role,
                addedById: authUser.id,
            });
        }
        const membersToAdd = [...usersToAdd, ...groupsToAdd];
        if (membersToAdd.length > 0) {
            await this.spaceMemberRepo.insertSpaceMember(membersToAdd);
            for (const user of validUsers) {
                this.auditService.log({
                    event: audit_events_1.AuditEvent.SPACE_MEMBER_ADDED,
                    resourceType: audit_events_1.AuditResource.SPACE_MEMBER,
                    resourceId: dto.spaceId,
                    spaceId: dto.spaceId,
                    changes: {
                        after: { role: dto.role },
                    },
                    metadata: {
                        spaceId: dto.spaceId,
                        spaceName: space.name,
                        userId: user.id,
                        userName: user.name,
                        memberType: 'user',
                    },
                });
            }
            for (const group of validGroups) {
                this.auditService.log({
                    event: audit_events_1.AuditEvent.SPACE_MEMBER_ADDED,
                    resourceType: audit_events_1.AuditResource.SPACE_MEMBER,
                    resourceId: dto.spaceId,
                    spaceId: dto.spaceId,
                    changes: {
                        after: { role: dto.role },
                    },
                    metadata: {
                        spaceId: dto.spaceId,
                        spaceName: space.name,
                        groupId: group.id,
                        groupName: group.name,
                        memberType: 'group',
                    },
                });
            }
        }
    }
    async removeMemberFromSpace(dto, workspaceId) {
        const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
        if (!space) {
            throw new common_1.NotFoundException('Space not found');
        }
        let spaceMember = null;
        if (dto.userId) {
            spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(dto.spaceId, {
                userId: dto.userId,
            });
        }
        else if (dto.groupId) {
            spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(dto.spaceId, {
                groupId: dto.groupId,
            });
        }
        else {
            throw new common_1.BadRequestException('Please provide a valid userId or groupId to remove');
        }
        if (!spaceMember) {
            throw new common_1.NotFoundException('Space membership not found');
        }
        if (spaceMember.role === permission_1.SpaceRole.ADMIN) {
            await this.validateLastAdmin(dto.spaceId);
        }
        let affectedUserIds = [];
        if (dto.userId) {
            affectedUserIds = [dto.userId];
        }
        else if (dto.groupId) {
            affectedUserIds = await this.groupUserRepo.getUserIdsByGroupId(dto.groupId);
        }
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            await this.spaceMemberRepo.removeSpaceMemberById(spaceMember.id, dto.spaceId, { trx });
            await this.watcherRepo.deleteByUsersWithoutSpaceAccess(affectedUserIds, dto.spaceId, { trx });
            await this.favoriteRepo.deleteByUsersWithoutSpaceAccess(affectedUserIds, dto.spaceId, { trx });
        });
        this.auditService.log({
            event: audit_events_1.AuditEvent.SPACE_MEMBER_REMOVED,
            resourceType: audit_events_1.AuditResource.SPACE_MEMBER,
            resourceId: dto.spaceId,
            spaceId: dto.spaceId,
            changes: {
                before: { role: spaceMember.role },
            },
            metadata: {
                spaceId: dto.spaceId,
                spaceName: space.name,
                userId: spaceMember.userId,
                groupId: spaceMember.groupId,
                memberType: spaceMember.userId ? 'user' : 'group',
            },
        });
    }
    async updateSpaceMemberRole(dto, workspaceId) {
        const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
        if (!space) {
            throw new common_1.NotFoundException('Space not found');
        }
        let spaceMember = null;
        if (dto.userId) {
            spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(dto.spaceId, {
                userId: dto.userId,
            });
        }
        else if (dto.groupId) {
            spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(dto.spaceId, {
                groupId: dto.groupId,
            });
        }
        else {
            throw new common_1.BadRequestException('Please provide a valid userId or groupId to remove');
        }
        if (!spaceMember) {
            throw new common_1.NotFoundException('Space membership not found');
        }
        if (spaceMember.role === dto.role) {
            return;
        }
        if (spaceMember.role === permission_1.SpaceRole.ADMIN) {
            await this.validateLastAdmin(dto.spaceId);
        }
        await this.spaceMemberRepo.updateSpaceMember({ role: dto.role }, spaceMember.id, dto.spaceId);
        this.auditService.log({
            event: audit_events_1.AuditEvent.SPACE_MEMBER_ROLE_CHANGED,
            resourceType: audit_events_1.AuditResource.SPACE_MEMBER,
            resourceId: dto.spaceId,
            spaceId: dto.spaceId,
            changes: {
                before: { role: spaceMember.role },
                after: { role: dto.role },
            },
            metadata: {
                spaceId: dto.spaceId,
                spaceName: space.name,
                userId: spaceMember.userId,
                groupId: spaceMember.groupId,
                memberType: spaceMember.userId ? 'user' : 'group',
            },
        });
    }
    async validateLastAdmin(spaceId) {
        const spaceOwnerCount = await this.spaceMemberRepo.roleCountBySpaceId(permission_1.SpaceRole.ADMIN, spaceId);
        if (spaceOwnerCount === 1) {
            throw new common_1.BadRequestException('There must be at least one space admin with full access');
        }
    }
    async getUserSpaces(userId, pagination) {
        return this.spaceMemberRepo.getUserSpaces(userId, pagination);
    }
};
exports.SpaceMemberService = SpaceMemberService;
exports.SpaceMemberService = SpaceMemberService = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, nestjs_kysely_1.InjectKysely)()),
    __param(6, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [space_member_repo_1.SpaceMemberRepo,
        group_user_repo_1.GroupUserRepo,
        space_repo_1.SpaceRepo,
        watcher_repo_1.WatcherRepo,
        favorite_repo_1.FavoriteRepo, Object, Object])
], SpaceMemberService);
//# sourceMappingURL=space-member.service.js.map