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
var WorkspaceInvitationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceInvitationService = void 0;
const common_1 = require("@nestjs/common");
const user_repo_1 = require("../../../database/repos/user/user.repo");
const nestjs_kysely_1 = require("nestjs-kysely");
const kysely_1 = require("kysely");
const utils_1 = require("../../../database/utils");
const mail_service_1 = require("../../../integrations/mail/mail.service");
const invitation_email_1 = require("../../../integrations/transactional/emails/invitation-email");
const group_user_repo_1 = require("../../../database/repos/group/group-user.repo");
const invitation_accepted_email_1 = require("../../../integrations/transactional/emails/invitation-accepted-email");
const token_service_1 = require("../../auth/services/token.service");
const session_service_1 = require("../../session/session.service");
const helpers_1 = require("../../../common/helpers");
const cursor_pagination_1 = require("../../../database/pagination/cursor-pagination");
const domain_service_1 = require("../../../integrations/environment/domain.service");
const bullmq_1 = require("@nestjs/bullmq");
const constants_1 = require("../../../integrations/queue/constants");
const bullmq_2 = require("bullmq");
const environment_service_1 = require("../../../integrations/environment/environment.service");
const auth_util_1 = require("../../auth/auth.util");
const audit_events_1 = require("../../../common/events/audit-events");
const audit_service_1 = require("../../../integrations/audit/audit.service");
const workspace_util_1 = require("../workspace.util");
let WorkspaceInvitationService = WorkspaceInvitationService_1 = class WorkspaceInvitationService {
    constructor(userRepo, groupUserRepo, mailService, domainService, tokenService, sessionService, db, billingQueue, environmentService, auditService) {
        this.userRepo = userRepo;
        this.groupUserRepo = groupUserRepo;
        this.mailService = mailService;
        this.domainService = domainService;
        this.tokenService = tokenService;
        this.sessionService = sessionService;
        this.db = db;
        this.billingQueue = billingQueue;
        this.environmentService = environmentService;
        this.auditService = auditService;
        this.logger = new common_1.Logger(WorkspaceInvitationService_1.name);
    }
    async getInvitations(workspaceId, pagination) {
        let query = this.db
            .selectFrom('workspaceInvitations')
            .select(['id', 'email', 'role', 'workspaceId', 'createdAt'])
            .where('workspaceId', '=', workspaceId);
        if (pagination.query) {
            query = query.where((eb) => eb((0, kysely_1.sql) `email`, 'ilike', (0, kysely_1.sql) `f_unaccent(${'%' + pagination.query + '%'})`));
        }
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [{ expression: 'id', direction: 'asc' }],
            parseCursor: (cursor) => ({ id: cursor.id }),
        });
    }
    async getInvitationById(invitationId, workspace) {
        const invitation = await this.db
            .selectFrom('workspaceInvitations')
            .select(['id', 'email', 'createdAt'])
            .where('id', '=', invitationId)
            .where('workspaceId', '=', workspace.id)
            .executeTakeFirst();
        if (!invitation) {
            throw new common_1.NotFoundException('Invitation not found');
        }
        return { ...invitation, enforceSso: workspace.enforceSso };
    }
    async getInvitationTokenById(invitationId, workspaceId) {
        const invitation = await this.db
            .selectFrom('workspaceInvitations')
            .select(['token'])
            .where('id', '=', invitationId)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
        if (!invitation) {
            throw new common_1.NotFoundException('Invitation not found');
        }
        return invitation;
    }
    async createInvitation(inviteUserDto, workspace, authUser) {
        const { emails, role, groupIds } = inviteUserDto;
        if ((0, workspace_util_1.isAdminActingOnOwner)(authUser.role, role)) {
            throw new common_1.ForbiddenException();
        }
        let invites = [];
        try {
            await (0, utils_1.executeTx)(this.db, async (trx) => {
                const findExistingUsers = await this.db
                    .selectFrom('users')
                    .select(['email'])
                    .where('users.email', 'in', emails)
                    .where('users.workspaceId', '=', workspace.id)
                    .execute();
                let existingUserEmails = [];
                if (findExistingUsers) {
                    existingUserEmails = findExistingUsers.map((user) => user.email);
                }
                const inviteEmails = emails.filter((email) => !existingUserEmails.includes(email));
                let validGroups = [];
                if (groupIds && groupIds.length > 0) {
                    validGroups = await trx
                        .selectFrom('groups')
                        .select(['id', 'name'])
                        .where('groups.id', 'in', groupIds)
                        .where('groups.workspaceId', '=', workspace.id)
                        .execute();
                }
                const invitesToInsert = inviteEmails.map((email) => ({
                    email: email,
                    role: role,
                    token: (0, helpers_1.nanoIdGen)(16),
                    workspaceId: workspace.id,
                    invitedById: authUser.id,
                    groupIds: validGroups?.map((group) => group.id),
                }));
                if (invitesToInsert.length < 1) {
                    return;
                }
                invites = await trx
                    .insertInto('workspaceInvitations')
                    .values(invitesToInsert)
                    .onConflict((oc) => oc.columns(['email', 'workspaceId']).doNothing())
                    .returningAll()
                    .execute();
            });
        }
        catch (err) {
            this.logger.error(`createInvitation - ${err}`);
            throw new common_1.BadRequestException('An error occurred while processing the invitations.');
        }
        if (invites) {
            invites.forEach((invitation) => {
                this.sendInvitationMail(invitation.id, invitation.email, invitation.token, authUser.name, workspace.hostname);
            });
            for (const invitation of invites) {
                this.auditService.log({
                    event: audit_events_1.AuditEvent.WORKSPACE_INVITE_CREATED,
                    resourceType: audit_events_1.AuditResource.WORKSPACE_INVITATION,
                    resourceId: invitation.id,
                    changes: {
                        after: {
                            email: invitation.email,
                            role: invitation.role,
                        },
                    },
                    metadata: {
                        groupIds: invitation.groupIds,
                    },
                });
            }
        }
    }
    async acceptInvitation(dto, workspace) {
        const invitation = await this.db
            .selectFrom('workspaceInvitations')
            .selectAll()
            .where('id', '=', dto.invitationId)
            .where('workspaceId', '=', workspace.id)
            .executeTakeFirst();
        if (!invitation) {
            throw new common_1.BadRequestException('Invitation not found');
        }
        if (dto.token !== invitation.token) {
            throw new common_1.BadRequestException('Invalid invitation token');
        }
        (0, auth_util_1.validateSsoEnforcement)(workspace);
        (0, auth_util_1.validateAllowedEmail)(invitation.email, workspace);
        let newUser;
        try {
            await (0, utils_1.executeTx)(this.db, async (trx) => {
                newUser = await this.userRepo.insertUser({
                    name: dto.name,
                    email: invitation.email,
                    emailVerifiedAt: new Date(),
                    password: dto.password,
                    role: invitation.role,
                    invitedById: invitation.invitedById,
                    workspaceId: workspace.id,
                }, trx);
                await this.groupUserRepo.addUserToDefaultGroup(newUser.id, workspace.id, trx);
                if (invitation.groupIds && invitation.groupIds.length > 0) {
                    const validGroups = await trx
                        .selectFrom('groups')
                        .select(['id', 'name'])
                        .where('groups.id', 'in', invitation.groupIds)
                        .where('groups.workspaceId', '=', workspace.id)
                        .execute();
                    if (validGroups && validGroups.length > 0) {
                        const groupUsersToInsert = validGroups.map((group) => ({
                            userId: newUser.id,
                            groupId: group.id,
                        }));
                        await trx
                            .insertInto('groupUsers')
                            .values(groupUsersToInsert)
                            .onConflict((oc) => oc.columns(['userId', 'groupId']).doNothing())
                            .execute();
                    }
                }
                await trx
                    .deleteFrom('workspaceInvitations')
                    .where('id', '=', invitation.id)
                    .execute();
            });
        }
        catch (err) {
            this.logger.error(`acceptInvitation - ${err}`);
            if (err.message.includes('unique constraint')) {
                throw new common_1.BadRequestException('Invitation already accepted');
            }
            throw new common_1.BadRequestException('Failed to accept invitation. An error occurred.');
        }
        if (!newUser) {
            return;
        }
        const invitedByUser = await this.userRepo.findById(invitation.invitedById, workspace.id);
        if (invitedByUser) {
            const emailTemplate = (0, invitation_accepted_email_1.default)({
                invitedUserName: newUser.name,
                invitedUserEmail: newUser.email,
            });
            await this.mailService.sendToQueue({
                to: invitedByUser.email,
                subject: `${newUser.name} has accepted your Docmost invite`,
                template: emailTemplate,
            });
        }
        this.auditService.log({
            event: audit_events_1.AuditEvent.USER_CREATED,
            resourceType: audit_events_1.AuditResource.USER,
            resourceId: newUser.id,
            changes: {
                after: {
                    name: newUser.name,
                    email: newUser.email,
                    role: invitation.role,
                },
            },
            metadata: {
                source: 'invitation',
                invitationId: invitation.id,
            },
        });
        if (this.environmentService.isCloud()) {
            await this.billingQueue.add(constants_1.QueueJob.STRIPE_SEATS_SYNC, {
                workspaceId: workspace.id,
            });
        }
        if (workspace.enforceMfa) {
            return {
                requiresLogin: true,
            };
        }
        const authToken = await this.sessionService.createSessionAndToken(newUser);
        return { authToken };
    }
    async resendInvitation(invitationId, workspace) {
        const invitation = await this.db
            .selectFrom('workspaceInvitations')
            .selectAll()
            .where('id', '=', invitationId)
            .where('workspaceId', '=', workspace.id)
            .executeTakeFirst();
        if (!invitation) {
            throw new common_1.BadRequestException('Invitation not found');
        }
        const invitedByUser = await this.userRepo.findById(invitation.invitedById, workspace.id);
        await this.sendInvitationMail(invitation.id, invitation.email, invitation.token, invitedByUser.name, workspace.hostname);
        this.auditService.log({
            event: audit_events_1.AuditEvent.WORKSPACE_INVITE_RESENT,
            resourceType: audit_events_1.AuditResource.WORKSPACE_INVITATION,
            resourceId: invitation.id,
            metadata: {
                email: invitation.email,
                role: invitation.role,
            },
        });
    }
    async revokeInvitation(invitationId, workspaceId) {
        const invitation = await this.db
            .selectFrom('workspaceInvitations')
            .select(['id', 'email', 'role'])
            .where('id', '=', invitationId)
            .where('workspaceId', '=', workspaceId)
            .executeTakeFirst();
        await this.db
            .deleteFrom('workspaceInvitations')
            .where('id', '=', invitationId)
            .where('workspaceId', '=', workspaceId)
            .execute();
        if (invitation) {
            this.auditService.log({
                event: audit_events_1.AuditEvent.WORKSPACE_INVITE_REVOKED,
                resourceType: audit_events_1.AuditResource.WORKSPACE_INVITATION,
                resourceId: invitation.id,
                changes: {
                    before: {
                        email: invitation.email,
                        role: invitation.role,
                    },
                },
            });
        }
    }
    async getInvitationLinkById(invitationId, workspace) {
        const token = await this.getInvitationTokenById(invitationId, workspace.id);
        return this.buildInviteLink({
            invitationId,
            inviteToken: token.token,
            hostname: workspace.hostname,
        });
    }
    async buildInviteLink(opts) {
        const { invitationId, inviteToken, hostname } = opts;
        return `${this.domainService.getUrl(hostname)}/invites/${invitationId}?token=${inviteToken}`;
    }
    async sendInvitationMail(invitationId, inviteeEmail, inviteToken, invitedByName, hostname) {
        const inviteLink = await this.buildInviteLink({
            invitationId,
            inviteToken,
            hostname,
        });
        const emailTemplate = (0, invitation_email_1.default)({
            inviteLink,
        });
        await this.mailService.sendToQueue({
            to: inviteeEmail,
            subject: `${invitedByName} invited you to Docmost`,
            template: emailTemplate,
        });
    }
};
exports.WorkspaceInvitationService = WorkspaceInvitationService;
exports.WorkspaceInvitationService = WorkspaceInvitationService = WorkspaceInvitationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, nestjs_kysely_1.InjectKysely)()),
    __param(7, (0, bullmq_1.InjectQueue)(constants_1.QueueName.BILLING_QUEUE)),
    __param(9, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [user_repo_1.UserRepo,
        group_user_repo_1.GroupUserRepo,
        mail_service_1.MailService,
        domain_service_1.DomainService,
        token_service_1.TokenService,
        session_service_1.SessionService, Object, bullmq_2.Queue,
        environment_service_1.EnvironmentService, Object])
], WorkspaceInvitationService);
//# sourceMappingURL=workspace-invitation.service.js.map