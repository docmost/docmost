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
exports.VerificationNotificationService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const notification_service_1 = require("../notification.service");
const notification_constants_1 = require("../notification.constants");
const verification_expiring_email_1 = require("../../../integrations/transactional/emails/verification-expiring-email");
const verification_expired_email_1 = require("../../../integrations/transactional/emails/verification-expired-email");
const approval_requested_email_1 = require("../../../integrations/transactional/emails/approval-requested-email");
const approval_rejected_email_1 = require("../../../integrations/transactional/emails/approval-rejected-email");
const helpers_1 = require("../../../common/helpers");
const space_member_repo_1 = require("../../../database/repos/space/space-member.repo");
const page_permission_repo_1 = require("../../../database/repos/page/page-permission.repo");
let VerificationNotificationService = class VerificationNotificationService {
    constructor(db, notificationService, spaceMemberRepo, pagePermissionRepo) {
        this.db = db;
        this.notificationService = notificationService;
        this.spaceMemberRepo = spaceMemberRepo;
        this.pagePermissionRepo = pagePermissionRepo;
    }
    async getAlreadyNotifiedUserIds(pageVerificationId, type) {
        const rows = await this.db
            .selectFrom('notifications')
            .select('userId')
            .where('pageVerificationId', '=', pageVerificationId)
            .where('type', '=', type)
            .execute();
        return new Set(rows.map((r) => r.userId));
    }
    async filterAccessibleRecipients(userIds, pageId, spaceId) {
        if (userIds.length === 0)
            return [];
        const inSpace = await this.spaceMemberRepo.getUserIdsWithSpaceAccess(userIds, spaceId);
        if (inSpace.size === 0)
            return [];
        return this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [
            ...inSpace,
        ]);
    }
    async processVerificationExpiring(data, appUrl) {
        const verification = await this.db
            .selectFrom('pageVerifications')
            .selectAll()
            .where('id', '=', data.verificationId)
            .executeTakeFirst();
        if (!verification)
            return;
        if (verification.type !== 'expiring')
            return;
        if (!verification.expiresAt)
            return;
        const expiresAtMs = new Date(verification.expiresAt).getTime();
        if (expiresAtMs <= Date.now())
            return;
        const verifierRows = await this.db
            .selectFrom('pageVerifiers')
            .select('userId')
            .where('pageVerificationId', '=', verification.id)
            .execute();
        const verifierIds = verifierRows.map((r) => r.userId);
        if (verifierIds.length === 0)
            return;
        const accessibleVerifierIds = await this.filterAccessibleRecipients(verifierIds, verification.pageId, verification.spaceId);
        if (accessibleVerifierIds.length === 0)
            return;
        const alreadyNotified = await this.getAlreadyNotifiedUserIds(verification.id, notification_constants_1.NotificationType.PAGE_VERIFICATION_EXPIRING);
        const recipients = accessibleVerifierIds.filter((id) => !alreadyNotified.has(id));
        if (recipients.length === 0)
            return;
        const context = await this.getPageContext(verification.pageId, verification.spaceId, appUrl);
        if (!context)
            return;
        const { pageTitle, spaceName, basePageUrl } = context;
        const expiresAtIso = new Date(verification.expiresAt).toISOString();
        for (const userId of recipients) {
            const notification = await this.notificationService.create({
                userId,
                workspaceId: verification.workspaceId,
                type: notification_constants_1.NotificationType.PAGE_VERIFICATION_EXPIRING,
                pageId: verification.pageId,
                spaceId: verification.spaceId,
                pageVerificationId: verification.id,
                data: { expiresAt: expiresAtIso },
            });
            const subject = `"${pageTitle}" needs to be re-verified soon`;
            await this.notificationService.queueEmail(userId, notification.id, subject, (0, verification_expiring_email_1.VerificationExpiringEmail)({
                pageTitle,
                spaceName,
                pageUrl: basePageUrl,
                expiresAt: new Date(verification.expiresAt).toLocaleDateString(),
            }));
        }
    }
    async processVerificationExpired(data, appUrl) {
        const verification = await this.db
            .selectFrom('pageVerifications')
            .selectAll()
            .where('id', '=', data.verificationId)
            .executeTakeFirst();
        if (!verification)
            return;
        if (verification.type !== 'expiring')
            return;
        if (!verification.expiresAt)
            return;
        if (new Date(verification.expiresAt).getTime() > Date.now())
            return;
        const verifierRows = await this.db
            .selectFrom('pageVerifiers')
            .select('userId')
            .where('pageVerificationId', '=', verification.id)
            .execute();
        const verifierIds = verifierRows.map((r) => r.userId);
        if (verifierIds.length === 0)
            return;
        const accessibleVerifierIds = await this.filterAccessibleRecipients(verifierIds, verification.pageId, verification.spaceId);
        if (accessibleVerifierIds.length === 0)
            return;
        const alreadyNotified = await this.getAlreadyNotifiedUserIds(verification.id, notification_constants_1.NotificationType.PAGE_VERIFICATION_EXPIRED);
        const recipients = accessibleVerifierIds.filter((id) => !alreadyNotified.has(id));
        if (recipients.length === 0)
            return;
        const context = await this.getPageContext(verification.pageId, verification.spaceId, appUrl);
        if (!context)
            return;
        const { pageTitle, spaceName, basePageUrl } = context;
        for (const userId of recipients) {
            const notification = await this.notificationService.create({
                userId,
                workspaceId: verification.workspaceId,
                type: notification_constants_1.NotificationType.PAGE_VERIFICATION_EXPIRED,
                pageId: verification.pageId,
                spaceId: verification.spaceId,
                pageVerificationId: verification.id,
            });
            const subject = `"${pageTitle}" verification has expired`;
            await this.notificationService.queueEmail(userId, notification.id, subject, (0, verification_expired_email_1.VerificationExpiredEmail)({
                pageTitle,
                spaceName,
                pageUrl: basePageUrl,
            }));
        }
    }
    async processPageVerified(data) {
        const { verifierIds, pageId, spaceId, workspaceId, actorId } = data;
        if (verifierIds.length === 0)
            return;
        const accessibleVerifierIds = await this.filterAccessibleRecipients(verifierIds, pageId, spaceId);
        if (accessibleVerifierIds.length === 0)
            return;
        for (const userId of accessibleVerifierIds) {
            await this.notificationService.create({
                userId,
                workspaceId,
                type: notification_constants_1.NotificationType.PAGE_VERIFIED,
                actorId,
                pageId,
                spaceId,
            });
        }
    }
    async processApprovalRequested(data, appUrl) {
        const { verifierIds, pageId, spaceId, workspaceId, actorId } = data;
        if (verifierIds.length === 0)
            return;
        const accessibleVerifierIds = await this.filterAccessibleRecipients(verifierIds, pageId, spaceId);
        if (accessibleVerifierIds.length === 0)
            return;
        const context = await this.getPageContext(pageId, spaceId, appUrl);
        if (!context)
            return;
        const { pageTitle, spaceName, basePageUrl } = context;
        const actorName = await this.getUserName(actorId);
        for (const userId of accessibleVerifierIds) {
            const notification = await this.notificationService.create({
                userId,
                workspaceId,
                type: notification_constants_1.NotificationType.PAGE_APPROVAL_REQUESTED,
                actorId,
                pageId,
                spaceId,
            });
            const subject = `"${pageTitle}" needs your approval`;
            await this.notificationService.queueEmail(userId, notification.id, subject, (0, approval_requested_email_1.ApprovalRequestedEmail)({
                actorName,
                pageTitle,
                spaceName,
                pageUrl: basePageUrl,
            }));
        }
    }
    async processApprovalRejected(data, appUrl) {
        const { pageId, spaceId, workspaceId, actorId, requestedById, comment } = data;
        const recipients = await this.filterAccessibleRecipients([requestedById], pageId, spaceId);
        if (recipients.length === 0)
            return;
        const context = await this.getPageContext(pageId, spaceId, appUrl);
        if (!context)
            return;
        const { pageTitle, spaceName, basePageUrl } = context;
        const actorName = await this.getUserName(actorId);
        const notification = await this.notificationService.create({
            userId: requestedById,
            workspaceId,
            type: notification_constants_1.NotificationType.PAGE_APPROVAL_REJECTED,
            actorId,
            pageId,
            spaceId,
        });
        const subject = `"${pageTitle}" was returned for revision`;
        await this.notificationService.queueEmail(requestedById, notification.id, subject, (0, approval_rejected_email_1.ApprovalRejectedEmail)({
            actorName,
            pageTitle,
            spaceName,
            pageUrl: basePageUrl,
            comment,
        }));
    }
    async getUserName(userId) {
        const user = await this.db
            .selectFrom('users')
            .select('name')
            .where('id', '=', userId)
            .executeTakeFirst();
        return user?.name ?? 'Someone';
    }
    async getPageContext(pageId, spaceId, appUrl) {
        const [page, space] = await Promise.all([
            this.db
                .selectFrom('pages')
                .select(['id', 'title', 'slugId'])
                .where('id', '=', pageId)
                .executeTakeFirst(),
            this.db
                .selectFrom('spaces')
                .select(['id', 'slug', 'name'])
                .where('id', '=', spaceId)
                .executeTakeFirst(),
        ]);
        if (!page || !space)
            return null;
        const basePageUrl = `${appUrl}/s/${space.slug}/p/${page.slugId}`;
        return { pageTitle: (0, helpers_1.getPageTitle)(page.title), spaceName: space.name ?? space.slug, basePageUrl };
    }
};
exports.VerificationNotificationService = VerificationNotificationService;
exports.VerificationNotificationService = VerificationNotificationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, notification_service_1.NotificationService,
        space_member_repo_1.SpaceMemberRepo,
        page_permission_repo_1.PagePermissionRepo])
], VerificationNotificationService);
//# sourceMappingURL=verification.notification.js.map