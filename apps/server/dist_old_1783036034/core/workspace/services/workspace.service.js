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
var WorkspaceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = void 0;
const common_1 = require("@nestjs/common");
const license_check_service_1 = require("../../../integrations/environment/license-check.service");
const user_session_repo_1 = require("../../../database/repos/session/user-session.repo");
const space_service_1 = require("../../space/services/space.service");
const permission_1 = require("../../../common/helpers/types/permission");
const space_member_service_1 = require("../../space/services/space-member.service");
const workspace_repo_1 = require("../../../database/repos/workspace/workspace.repo");
const utils_1 = require("../../../database/utils");
const nestjs_kysely_1 = require("nestjs-kysely");
const features_1 = require("../../../common/features");
const group_user_repo_1 = require("../../../database/repos/group/group-user.repo");
const group_repo_1 = require("../../../database/repos/group/group.repo");
const user_repo_1 = require("../../../database/repos/user/user.repo");
const environment_service_1 = require("../../../integrations/environment/environment.service");
const domain_service_1 = require("../../../integrations/environment/domain.service");
const postgres_1 = require("kysely/helpers/postgres");
const date_fns_1 = require("date-fns");
const workspace_constants_1 = require("../workspace.constants");
const workspace_util_1 = require("../workspace.util");
const uuid_1 = require("uuid");
const bullmq_1 = require("@nestjs/bullmq");
const constants_1 = require("../../../integrations/queue/constants");
const bullmq_2 = require("bullmq");
const helpers_1 = require("../../../common/helpers");
const helpers_2 = require("../../../database/helpers/helpers");
const share_repo_1 = require("../../../database/repos/share/share.repo");
const watcher_repo_1 = require("../../../database/repos/watcher/watcher.repo");
const favorite_repo_1 = require("../../../database/repos/favorite/favorite.repo");
const audit_events_1 = require("../../../common/events/audit-events");
const audit_service_1 = require("../../../integrations/audit/audit.service");
let WorkspaceService = WorkspaceService_1 = class WorkspaceService {
    constructor(workspaceRepo, spaceService, spaceMemberService, groupRepo, groupUserRepo, userRepo, environmentService, domainService, licenseCheckService, shareRepo, watcherRepo, favoriteRepo, db, attachmentQueue, billingQueue, aiQueue, auditService, userSessionRepo) {
        this.workspaceRepo = workspaceRepo;
        this.spaceService = spaceService;
        this.spaceMemberService = spaceMemberService;
        this.groupRepo = groupRepo;
        this.groupUserRepo = groupUserRepo;
        this.userRepo = userRepo;
        this.environmentService = environmentService;
        this.domainService = domainService;
        this.licenseCheckService = licenseCheckService;
        this.shareRepo = shareRepo;
        this.watcherRepo = watcherRepo;
        this.favoriteRepo = favoriteRepo;
        this.db = db;
        this.attachmentQueue = attachmentQueue;
        this.billingQueue = billingQueue;
        this.aiQueue = aiQueue;
        this.auditService = auditService;
        this.userSessionRepo = userSessionRepo;
        this.logger = new common_1.Logger(WorkspaceService_1.name);
    }
    async findById(workspaceId) {
        return this.workspaceRepo.findById(workspaceId);
    }
    async getWorkspaceInfo(workspaceId) {
        const workspace = await this.workspaceRepo.findById(workspaceId);
        if (!workspace) {
            throw new common_1.NotFoundException('Workspace not found');
        }
        return workspace;
    }
    async getWorkspacePublicData(workspaceId) {
        const workspace = await this.db
            .selectFrom('workspaces')
            .select(['id', 'name', 'logo', 'hostname', 'enforceSso', 'licenseKey', 'plan'])
            .select((eb) => (0, postgres_1.jsonArrayFrom)(eb
            .selectFrom('authProviders')
            .select([
            'authProviders.id',
            'authProviders.name',
            'authProviders.type',
        ])
            .where('authProviders.isEnabled', '=', true)
            .where('workspaceId', '=', workspaceId)).as('authProviders'))
            .where('id', '=', workspaceId)
            .executeTakeFirst();
        if (!workspace) {
            throw new common_1.NotFoundException('Workspace not found');
        }
        const { licenseKey, plan, ...rest } = workspace;
        return rest;
    }
    async create(user, createWorkspaceDto, trx) {
        let trialEndAt = undefined;
        const createdWorkspace = await (0, utils_1.executeTx)(this.db, async (trx) => {
            let hostname = undefined;
            let status = undefined;
            let plan = undefined;
            let billingEmail = undefined;
            let settings = undefined;
            if (this.environmentService.isCloud()) {
                hostname = await this.generateHostname(createWorkspaceDto.hostname ?? createWorkspaceDto.name);
                trialEndAt = (0, date_fns_1.addDays)(new Date(), this.environmentService.getBillingTrialDays());
                status = workspace_constants_1.WorkspaceStatus.Active;
                plan = 'standard';
                billingEmail = user.email;
                settings = { ai: { generative: true, chat: true } };
            }
            const workspace = await this.workspaceRepo.insertWorkspace({
                name: createWorkspaceDto.name,
                description: createWorkspaceDto.description,
                hostname,
                status,
                trialEndAt,
                plan,
                billingEmail,
                settings,
            }, trx);
            const group = await this.groupRepo.createDefaultGroup(workspace.id, {
                userId: user.id,
                trx: trx,
            });
            await trx
                .updateTable('users')
                .set({
                workspaceId: workspace.id,
                role: permission_1.UserRole.OWNER,
            })
                .where('users.id', '=', user.id)
                .execute();
            await this.groupUserRepo.insertGroupUser({
                userId: user.id,
                groupId: group.id,
            }, trx);
            const spaceInfo = {
                name: 'General',
                slug: 'general',
            };
            const createdSpace = await this.spaceService.create(user.id, workspace.id, spaceInfo, trx);
            await this.spaceMemberService.addUserToSpace(user.id, createdSpace.id, permission_1.SpaceRole.ADMIN, workspace.id, trx);
            await this.spaceMemberService.addGroupToSpace(group.id, createdSpace.id, permission_1.SpaceRole.WRITER, workspace.id, trx);
            workspace.defaultSpaceId = createdSpace.id;
            await this.workspaceRepo.updateWorkspace({
                defaultSpaceId: createdSpace.id,
            }, workspace.id, trx);
            return workspace;
        }, trx);
        if (this.environmentService.isCloud() && trialEndAt) {
            try {
                const delay = trialEndAt.getTime() - Date.now();
                await this.billingQueue.add(constants_1.QueueJob.TRIAL_ENDED, { workspaceId: createdWorkspace.id }, { delay });
                await this.billingQueue.add(constants_1.QueueJob.WELCOME_EMAIL, { userId: user.id }, { delay: 30 * 60 * 1000 });
            }
            catch (err) {
                this.logger.error(err);
            }
        }
        return createdWorkspace;
    }
    async addUserToWorkspace(userId, workspaceId, assignedRole, trx) {
        return await (0, utils_1.executeTx)(this.db, async (trx) => {
            const workspace = await trx
                .selectFrom('workspaces')
                .select(['id', 'defaultRole'])
                .where('workspaces.id', '=', workspaceId)
                .executeTakeFirst();
            if (!workspace) {
                throw new common_1.BadRequestException('Workspace not found');
            }
            await trx
                .updateTable('users')
                .set({
                role: assignedRole ?? workspace.defaultRole,
                workspaceId: workspace.id,
            })
                .where('id', '=', userId)
                .execute();
        }, trx);
    }
    async update(workspaceId, updateWorkspaceDto) {
        if (updateWorkspaceDto.enforceSso) {
            const sso = await this.db
                .selectFrom('authProviders')
                .select(['id'])
                .where('isEnabled', '=', true)
                .where('workspaceId', '=', workspaceId)
                .execute();
            if (sso && sso?.length === 0) {
                throw new common_1.BadRequestException('There must be at least one active SSO provider to enforce SSO.');
            }
        }
        if (updateWorkspaceDto.emailDomains) {
            const regex = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/;
            const emailDomains = updateWorkspaceDto.emailDomains || [];
            updateWorkspaceDto.emailDomains = emailDomains
                .map((domain) => regex.exec(domain)?.[0])
                .filter(Boolean);
        }
        if (updateWorkspaceDto.hostname) {
            const hostname = updateWorkspaceDto.hostname;
            if (workspace_constants_1.DISALLOWED_HOSTNAMES.includes(hostname)) {
                throw new common_1.BadRequestException('Hostname already exists.');
            }
            if (await this.workspaceRepo.hostnameExists(hostname)) {
                throw new common_1.BadRequestException('Hostname already exists.');
            }
        }
        const before = {};
        const after = {};
        if (typeof updateWorkspaceDto.disablePublicSharing !== 'undefined' ||
            typeof updateWorkspaceDto.trashRetentionDays !== 'undefined' ||
            typeof updateWorkspaceDto.mcpEnabled !== 'undefined' ||
            typeof updateWorkspaceDto.restrictApiToAdmins !== 'undefined' ||
            typeof updateWorkspaceDto.allowMemberTemplates !== 'undefined' ||
            typeof updateWorkspaceDto.isScimEnabled !== 'undefined') {
            const ws = await this.db
                .selectFrom('workspaces')
                .select(['id', 'licenseKey', 'plan', 'trashRetentionDays'])
                .where('id', '=', workspaceId)
                .executeTakeFirst();
            if (!ws) {
                throw new common_1.NotFoundException('Workspace not found');
            }
            if (typeof updateWorkspaceDto.mcpEnabled !== 'undefined') {
                if (!this.licenseCheckService.hasFeature(ws.licenseKey, 'mcp', ws.plan)) {
                    throw new common_1.ForbiddenException('This feature requires a valid license');
                }
            }
            if (typeof updateWorkspaceDto.isScimEnabled !== 'undefined') {
                if (!this.licenseCheckService.hasFeature(ws.licenseKey, features_1.Feature.SCIM, ws.plan)) {
                    throw new common_1.ForbiddenException('This feature requires a valid license');
                }
            }
            if (typeof updateWorkspaceDto.disablePublicSharing !== 'undefined' ||
                typeof updateWorkspaceDto.trashRetentionDays !== 'undefined' ||
                typeof updateWorkspaceDto.restrictApiToAdmins !== 'undefined' ||
                typeof updateWorkspaceDto.allowMemberTemplates !== 'undefined') {
                if (!this.licenseCheckService.hasFeature(ws.licenseKey, features_1.Feature.SECURITY_SETTINGS, ws.plan)) {
                    throw new common_1.ForbiddenException('This feature requires a valid license');
                }
            }
            if (typeof updateWorkspaceDto.trashRetentionDays !== 'undefined' &&
                updateWorkspaceDto.trashRetentionDays !== ws.trashRetentionDays) {
                before.trashRetentionDays = ws.trashRetentionDays;
                after.trashRetentionDays = updateWorkspaceDto.trashRetentionDays;
            }
        }
        if (updateWorkspaceDto.aiSearch) {
            const tableExists = await (0, helpers_2.isPageEmbeddingsTableExists)(this.db);
            if (!tableExists) {
                throw new common_1.BadRequestException('Failed to activate. Make sure pgvector postgres extension is installed.');
            }
        }
        const workspaceBefore = await this.workspaceRepo.findById(workspaceId);
        const settingsBefore = (workspaceBefore?.settings ?? {});
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            if (typeof updateWorkspaceDto.restrictApiToAdmins !== 'undefined') {
                const prev = settingsBefore?.api?.restrictToAdmins ?? false;
                if (prev !== updateWorkspaceDto.restrictApiToAdmins) {
                    before.restrictApiToAdmins = prev;
                    after.restrictApiToAdmins = updateWorkspaceDto.restrictApiToAdmins;
                }
                await this.workspaceRepo.updateApiSettings(workspaceId, 'restrictToAdmins', updateWorkspaceDto.restrictApiToAdmins, trx);
            }
            if (typeof updateWorkspaceDto.aiSearch !== 'undefined') {
                const prev = settingsBefore?.ai?.search ?? false;
                if (prev !== updateWorkspaceDto.aiSearch) {
                    before.aiSearch = prev;
                    after.aiSearch = updateWorkspaceDto.aiSearch;
                }
                await this.workspaceRepo.updateAiSettings(workspaceId, 'search', updateWorkspaceDto.aiSearch, trx);
            }
            if (typeof updateWorkspaceDto.generativeAi !== 'undefined') {
                const prev = settingsBefore?.ai?.generative ?? false;
                if (prev !== updateWorkspaceDto.generativeAi) {
                    before.generativeAi = prev;
                    after.generativeAi = updateWorkspaceDto.generativeAi;
                }
                await this.workspaceRepo.updateAiSettings(workspaceId, 'generative', updateWorkspaceDto.generativeAi, trx);
            }
            if (typeof updateWorkspaceDto.disablePublicSharing !== 'undefined') {
                const prev = settingsBefore?.sharing?.disabled ?? false;
                if (prev !== updateWorkspaceDto.disablePublicSharing) {
                    before.disablePublicSharing = prev;
                    after.disablePublicSharing = updateWorkspaceDto.disablePublicSharing;
                }
                await this.workspaceRepo.updateSharingSettings(workspaceId, 'disabled', updateWorkspaceDto.disablePublicSharing, trx);
                if (updateWorkspaceDto.disablePublicSharing) {
                    await this.shareRepo.deleteByWorkspaceId(workspaceId, trx);
                }
            }
            if (typeof updateWorkspaceDto.mcpEnabled !== 'undefined') {
                const prev = settingsBefore?.ai?.mcp ?? false;
                if (prev !== updateWorkspaceDto.mcpEnabled) {
                    before.mcpEnabled = prev;
                    after.mcpEnabled = updateWorkspaceDto.mcpEnabled;
                }
                await this.workspaceRepo.updateAiSettings(workspaceId, 'mcp', updateWorkspaceDto.mcpEnabled, trx);
            }
            if (typeof updateWorkspaceDto.allowMemberTemplates !== 'undefined') {
                const prev = settingsBefore?.templates?.allowMemberTemplates ?? false;
                if (prev !== updateWorkspaceDto.allowMemberTemplates) {
                    before.allowMemberTemplates = prev;
                    after.allowMemberTemplates = updateWorkspaceDto.allowMemberTemplates;
                }
                await this.workspaceRepo.updateTemplateSettings(workspaceId, 'allowMemberTemplates', updateWorkspaceDto.allowMemberTemplates, trx);
            }
            if (typeof updateWorkspaceDto.aiChat !== 'undefined') {
                const prev = settingsBefore?.ai?.chat ?? false;
                if (prev !== updateWorkspaceDto.aiChat) {
                    before.aiChat = prev;
                    after.aiChat = updateWorkspaceDto.aiChat;
                }
                await this.workspaceRepo.updateAiSettings(workspaceId, 'chat', updateWorkspaceDto.aiChat, trx);
            }
            delete updateWorkspaceDto.restrictApiToAdmins;
            delete updateWorkspaceDto.aiSearch;
            delete updateWorkspaceDto.generativeAi;
            delete updateWorkspaceDto.disablePublicSharing;
            delete updateWorkspaceDto.mcpEnabled;
            delete updateWorkspaceDto.allowMemberTemplates;
            delete updateWorkspaceDto.aiChat;
            await this.workspaceRepo.updateWorkspace(updateWorkspaceDto, workspaceId, trx);
        });
        if (after.aiSearch === true) {
            await this.aiQueue.add(constants_1.QueueJob.WORKSPACE_CREATE_EMBEDDINGS, {
                workspaceId,
            });
        }
        else if (after.aiSearch === false) {
            const deleteJobId = `ai-search-disabled-${workspaceId}`;
            await this.aiQueue.add(constants_1.QueueJob.WORKSPACE_DELETE_EMBEDDINGS, { workspaceId }, {
                jobId: deleteJobId,
                delay: 24 * 60 * 60 * 1000,
                removeOnComplete: true,
                removeOnFail: true,
            });
        }
        const workspace = await this.workspaceRepo.findById(workspaceId, {
            withMemberCount: true,
            withLicenseKey: true,
        });
        const columnChanges = (0, helpers_1.diffAuditTrackedFields)([
            'name',
            'logo',
            'enforceSso',
            'enforceMfa',
            'emailDomains',
            'isScimEnabled',
        ], updateWorkspaceDto, workspaceBefore, workspace);
        if (columnChanges) {
            Object.assign(before, columnChanges.before);
            Object.assign(after, columnChanges.after);
        }
        if (Object.keys(after).length > 0) {
            this.auditService.log({
                event: audit_events_1.AuditEvent.WORKSPACE_UPDATED,
                resourceType: audit_events_1.AuditResource.WORKSPACE,
                resourceId: workspaceId,
                changes: { before, after },
            });
        }
        const { licenseKey, ...rest } = workspace;
        return rest;
    }
    async getWorkspaceUsers(workspaceId, pagination) {
        return this.userRepo.getUsersPaginated(workspaceId, pagination);
    }
    async updateWorkspaceUserRole(authUser, userRoleDto, workspaceId) {
        const user = await this.userRepo.findById(userRoleDto.userId, workspaceId);
        const newRole = userRoleDto.role.toLowerCase();
        if (!user) {
            throw new common_1.BadRequestException('Workspace member not found');
        }
        if ((0, workspace_util_1.isAdminActingOnOwner)(authUser.role, newRole) ||
            (0, workspace_util_1.isAdminActingOnOwner)(authUser.role, user.role)) {
            throw new common_1.ForbiddenException();
        }
        if (user.role === newRole) {
            return user;
        }
        const workspaceOwnerCount = await this.userRepo.roleCountByWorkspaceId(permission_1.UserRole.OWNER, workspaceId);
        if (user.role === permission_1.UserRole.OWNER && workspaceOwnerCount === 1) {
            throw new common_1.BadRequestException('There must be at least one workspace owner');
        }
        await this.userRepo.updateUser({
            role: newRole,
        }, user.id, workspaceId);
        this.auditService.log({
            event: audit_events_1.AuditEvent.USER_ROLE_CHANGED,
            resourceType: audit_events_1.AuditResource.USER,
            resourceId: user.id,
            changes: {
                before: { role: user.role },
                after: { role: newRole },
            },
        });
    }
    async generateHostname(name, trx) {
        let subdomain = name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 20)
            .replace(/^-+|-+$/g, '');
        const maxSuffixLength = 6;
        if (subdomain.length < 4) {
            subdomain = `${subdomain}-${(0, helpers_1.generateRandomSuffixNumbers)(maxSuffixLength)}`;
        }
        if (workspace_constants_1.DISALLOWED_HOSTNAMES.includes(subdomain)) {
            subdomain = `workspace-${(0, helpers_1.generateRandomSuffixNumbers)(maxSuffixLength)}`;
        }
        let uniqueHostname = subdomain;
        while (true) {
            const exists = await this.workspaceRepo.hostnameExists(uniqueHostname, trx);
            if (!exists) {
                break;
            }
            const randomSuffix = (0, helpers_1.generateRandomSuffixNumbers)(maxSuffixLength);
            uniqueHostname = `${subdomain}-${randomSuffix}`.substring(0, 25);
        }
        return uniqueHostname;
    }
    async checkHostname(hostname) {
        const exists = await this.workspaceRepo.hostnameExists(hostname);
        if (!exists) {
            throw new common_1.NotFoundException('Hostname not found');
        }
        return { hostname: this.domainService.getUrl(hostname) };
    }
    async deactivateUser(authUser, userId, workspaceId) {
        const user = await this.userRepo.findById(userId, workspaceId);
        if (!user || user.deletedAt) {
            throw new common_1.BadRequestException('Workspace member not found');
        }
        if (user.deactivatedAt) {
            throw new common_1.BadRequestException('User is already deactivated');
        }
        if (authUser.id === userId) {
            throw new common_1.BadRequestException('You cannot deactivate yourself');
        }
        if ((0, workspace_util_1.isAdminActingOnOwner)(authUser.role, user.role)) {
            throw new common_1.BadRequestException('You cannot deactivate a user with owner role');
        }
        if (user.role === permission_1.UserRole.OWNER) {
            const workspaceOwnerCount = await this.userRepo.roleCountByWorkspaceId(permission_1.UserRole.OWNER, workspaceId);
            if (workspaceOwnerCount === 1) {
                throw new common_1.BadRequestException('There must be at least one workspace owner');
            }
        }
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            await this.userRepo.updateUser({ deactivatedAt: new Date() }, userId, workspaceId, trx);
            await this.userSessionRepo.revokeByUserId(userId, workspaceId, trx);
        });
        this.auditService.log({
            event: audit_events_1.AuditEvent.USER_DEACTIVATED,
            resourceType: audit_events_1.AuditResource.USER,
            resourceId: user.id,
            changes: {
                before: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
        });
    }
    async activateUser(authUser, userId, workspaceId) {
        const user = await this.userRepo.findById(userId, workspaceId);
        if (!user || user.deletedAt) {
            throw new common_1.BadRequestException('Workspace member not found');
        }
        if (!user.deactivatedAt) {
            throw new common_1.BadRequestException('User is not deactivated');
        }
        if ((0, workspace_util_1.isAdminActingOnOwner)(authUser.role, user.role)) {
            throw new common_1.BadRequestException('You cannot activate a user with owner role');
        }
        await this.userRepo.updateUser({ deactivatedAt: null }, userId, workspaceId);
        this.auditService.log({
            event: audit_events_1.AuditEvent.USER_ACTIVATED,
            resourceType: audit_events_1.AuditResource.USER,
            resourceId: user.id,
            changes: {
                before: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
        });
    }
    async deleteUser(authUser, userId, workspaceId) {
        const user = await this.userRepo.findById(userId, workspaceId);
        if (!user || user.deletedAt) {
            throw new common_1.BadRequestException('Workspace member not found');
        }
        const workspaceOwnerCount = await this.userRepo.roleCountByWorkspaceId(permission_1.UserRole.OWNER, workspaceId);
        if (user.role === permission_1.UserRole.OWNER && workspaceOwnerCount === 1) {
            throw new common_1.BadRequestException('There must be at least one workspace owner');
        }
        if (authUser.id === userId) {
            throw new common_1.BadRequestException('You cannot delete yourself');
        }
        if ((0, workspace_util_1.isAdminActingOnOwner)(authUser.role, user.role)) {
            throw new common_1.BadRequestException('You cannot delete a user with owner role');
        }
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            await this.userRepo.updateUser({
                name: 'Deleted user',
                email: (0, uuid_1.v4)() + '@deleted.docmost.com',
                avatarUrl: null,
                settings: null,
                deletedAt: new Date(),
            }, userId, workspaceId, trx);
            await trx.deleteFrom('groupUsers').where('userId', '=', userId).execute();
            await trx
                .deleteFrom('spaceMembers')
                .where('userId', '=', userId)
                .execute();
            await trx
                .deleteFrom('authAccounts')
                .where('userId', '=', userId)
                .execute();
            await this.watcherRepo.deleteByUserAndWorkspace(userId, workspaceId, {
                trx,
            });
            await this.favoriteRepo.deleteByUserAndWorkspace(userId, workspaceId, {
                trx,
            });
            await this.userSessionRepo.revokeByUserId(userId, workspaceId, trx);
        });
        this.auditService.log({
            event: audit_events_1.AuditEvent.USER_DELETED,
            resourceType: audit_events_1.AuditResource.USER,
            resourceId: user.id,
            changes: {
                before: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
        });
        try {
            await this.attachmentQueue.add(constants_1.QueueJob.DELETE_USER_AVATARS, user);
        }
        catch (err) {
        }
    }
};
exports.WorkspaceService = WorkspaceService;
exports.WorkspaceService = WorkspaceService = WorkspaceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(12, (0, nestjs_kysely_1.InjectKysely)()),
    __param(13, (0, bullmq_1.InjectQueue)(constants_1.QueueName.ATTACHMENT_QUEUE)),
    __param(14, (0, bullmq_1.InjectQueue)(constants_1.QueueName.BILLING_QUEUE)),
    __param(15, (0, bullmq_1.InjectQueue)(constants_1.QueueName.AI_QUEUE)),
    __param(16, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [workspace_repo_1.WorkspaceRepo,
        space_service_1.SpaceService,
        space_member_service_1.SpaceMemberService,
        group_repo_1.GroupRepo,
        group_user_repo_1.GroupUserRepo,
        user_repo_1.UserRepo,
        environment_service_1.EnvironmentService,
        domain_service_1.DomainService,
        license_check_service_1.LicenseCheckService,
        share_repo_1.ShareRepo,
        watcher_repo_1.WatcherRepo,
        favorite_repo_1.FavoriteRepo, Object, bullmq_2.Queue,
        bullmq_2.Queue,
        bullmq_2.Queue, Object, user_session_repo_1.UserSessionRepo])
], WorkspaceService);
//# sourceMappingURL=workspace.service.js.map