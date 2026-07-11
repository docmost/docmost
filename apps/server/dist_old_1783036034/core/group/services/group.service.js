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
exports.GroupService = void 0;
const common_1 = require("@nestjs/common");
const group_repo_1 = require("../../../database/repos/group/group.repo");
const group_user_repo_1 = require("../../../database/repos/group/group-user.repo");
const space_member_repo_1 = require("../../../database/repos/space/space-member.repo");
const group_user_service_1 = require("./group-user.service");
const watcher_repo_1 = require("../../../database/repos/watcher/watcher.repo");
const favorite_repo_1 = require("../../../database/repos/favorite/favorite.repo");
const utils_1 = require("../../../database/utils");
const nestjs_kysely_1 = require("nestjs-kysely");
const audit_events_1 = require("../../../common/events/audit-events");
const helpers_1 = require("../../../common/helpers");
const audit_service_1 = require("../../../integrations/audit/audit.service");
let GroupService = class GroupService {
    constructor(groupRepo, groupUserRepo, spaceMemberRepo, groupUserService, watcherRepo, favoriteRepo, db, auditService) {
        this.groupRepo = groupRepo;
        this.groupUserRepo = groupUserRepo;
        this.spaceMemberRepo = spaceMemberRepo;
        this.groupUserService = groupUserService;
        this.watcherRepo = watcherRepo;
        this.favoriteRepo = favoriteRepo;
        this.db = db;
        this.auditService = auditService;
    }
    async getGroupInfo(groupId, workspaceId) {
        const group = await this.groupRepo.findById(groupId, workspaceId, {
            includeMemberCount: true,
        });
        if (!group) {
            throw new common_1.NotFoundException('Group not found');
        }
        return group;
    }
    async createGroup(authUser, workspaceId, createGroupDto, trx) {
        const groupExists = await this.groupRepo.findByName(createGroupDto.name, workspaceId);
        if (groupExists) {
            throw new common_1.BadRequestException('Group name already exists');
        }
        const insertableGroup = {
            name: createGroupDto.name,
            description: createGroupDto.description,
            isDefault: false,
            creatorId: authUser.id,
            workspaceId: workspaceId,
        };
        const createdGroup = await this.groupRepo.insertGroup(insertableGroup, trx);
        if (createGroupDto?.userIds && createGroupDto.userIds.length > 0) {
            await this.groupUserService.addUsersToGroupBatch(createGroupDto.userIds, createdGroup.id, workspaceId);
        }
        this.auditService.log({
            event: audit_events_1.AuditEvent.GROUP_CREATED,
            resourceType: audit_events_1.AuditResource.GROUP,
            resourceId: createdGroup.id,
            changes: {
                after: {
                    name: createdGroup.name,
                    description: createdGroup.description,
                },
            },
        });
        return createdGroup;
    }
    async updateGroup(workspaceId, updateGroupDto) {
        const group = await this.groupRepo.findById(updateGroupDto.groupId, workspaceId, { includeMemberCount: true });
        if (!group) {
            throw new common_1.NotFoundException('Group not found');
        }
        if (group.isDefault) {
            throw new common_1.BadRequestException('You cannot update a default group');
        }
        const groupBefore = { name: group.name, description: group.description };
        if (updateGroupDto.name) {
            const existingGroup = await this.groupRepo.findByName(updateGroupDto.name, workspaceId);
            if (existingGroup && group.name !== existingGroup.name) {
                throw new common_1.BadRequestException('Group name already exists');
            }
            group.name = updateGroupDto.name;
        }
        if (updateGroupDto.description) {
            group.description = updateGroupDto.description;
        }
        await this.groupRepo.update({
            name: updateGroupDto.name,
            description: updateGroupDto.description,
        }, group.id, workspaceId);
        const changes = (0, helpers_1.diffAuditTrackedFields)(['name', 'description'], updateGroupDto, groupBefore, group);
        if (changes) {
            this.auditService.log({
                event: audit_events_1.AuditEvent.GROUP_UPDATED,
                resourceType: audit_events_1.AuditResource.GROUP,
                resourceId: group.id,
                changes,
            });
        }
        return group;
    }
    async getWorkspaceGroups(workspaceId, paginationOptions) {
        return this.groupRepo.getGroupsPaginated(workspaceId, paginationOptions);
    }
    async deleteGroup(groupId, workspaceId) {
        const group = await this.findAndValidateGroup(groupId, workspaceId);
        if (group.isDefault) {
            throw new common_1.BadRequestException('You cannot delete a default group');
        }
        const [userIds, spaceIds] = await Promise.all([
            this.groupUserRepo.getUserIdsByGroupId(groupId),
            this.spaceMemberRepo.getSpaceIdsByGroupId(groupId),
        ]);
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            await this.groupRepo.delete(groupId, workspaceId, { trx });
            for (const spaceId of spaceIds) {
                await this.watcherRepo.deleteByUsersWithoutSpaceAccess(userIds, spaceId, { trx });
                await this.favoriteRepo.deleteByUsersWithoutSpaceAccess(userIds, spaceId, { trx });
            }
        });
        this.auditService.log({
            event: audit_events_1.AuditEvent.GROUP_DELETED,
            resourceType: audit_events_1.AuditResource.GROUP,
            resourceId: groupId,
            changes: {
                before: {
                    name: group.name,
                    description: group.description,
                },
            },
        });
    }
    async findAndValidateGroup(groupId, workspaceId, trx) {
        const group = await this.groupRepo.findById(groupId, workspaceId, {
            trx,
        });
        if (!group) {
            throw new common_1.NotFoundException('Group not found');
        }
        return group;
    }
};
exports.GroupService = GroupService;
exports.GroupService = GroupService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => group_user_service_1.GroupUserService))),
    __param(6, (0, nestjs_kysely_1.InjectKysely)()),
    __param(7, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [group_repo_1.GroupRepo,
        group_user_repo_1.GroupUserRepo,
        space_member_repo_1.SpaceMemberRepo,
        group_user_service_1.GroupUserService,
        watcher_repo_1.WatcherRepo,
        favorite_repo_1.FavoriteRepo, Object, Object])
], GroupService);
//# sourceMappingURL=group.service.js.map