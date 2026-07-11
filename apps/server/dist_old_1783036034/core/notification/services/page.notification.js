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
var PageNotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageNotificationService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const notification_service_1 = require("../notification.service");
const notification_constants_1 = require("../notification.constants");
const notification_repo_1 = require("../../../database/repos/notification/notification.repo");
const space_member_repo_1 = require("../../../database/repos/space/space-member.repo");
const page_permission_repo_1 = require("../../../database/repos/page/page-permission.repo");
const watcher_repo_1 = require("../../../database/repos/watcher/watcher.repo");
const page_update_email_rate_limiter_1 = require("./page-update-email-rate-limiter");
const page_mention_email_1 = require("../../../integrations/transactional/emails/page-mention-email");
const page_update_email_1 = require("../../../integrations/transactional/emails/page-update-email");
const page_update_digest_email_1 = require("../../../integrations/transactional/emails/page-update-digest-email");
const permission_granted_email_1 = require("../../../integrations/transactional/emails/permission-granted-email");
const helpers_1 = require("../../../common/helpers");
const constants_1 = require("../../../integrations/queue/constants");
const PAGE_UPDATE_COOLDOWN_HOURS = 7;
const DIGEST_DELAY_MS = 12 * 60 * 60 * 1000;
let PageNotificationService = PageNotificationService_1 = class PageNotificationService {
    constructor(db, notificationService, notificationRepo, spaceMemberRepo, pagePermissionRepo, watcherRepo, rateLimiter, notificationQueue) {
        this.db = db;
        this.notificationService = notificationService;
        this.notificationRepo = notificationRepo;
        this.spaceMemberRepo = spaceMemberRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.watcherRepo = watcherRepo;
        this.rateLimiter = rateLimiter;
        this.notificationQueue = notificationQueue;
        this.logger = new common_1.Logger(PageNotificationService_1.name);
    }
    async processPageMention(data, appUrl) {
        const { userMentions, oldMentionedUserIds, pageId, spaceId, workspaceId } = data;
        const oldIds = new Set(oldMentionedUserIds);
        const newMentions = userMentions.filter((m) => !oldIds.has(m.userId) && m.creatorId !== m.userId);
        if (newMentions.length === 0)
            return;
        const candidateUserIds = newMentions.map((m) => m.userId);
        const usersWithSpaceAccess = await this.spaceMemberRepo.getUserIdsWithSpaceAccess(candidateUserIds, spaceId);
        const usersWithPageAccess = await this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [
            ...usersWithSpaceAccess,
        ]);
        const usersWithAccess = new Set(usersWithPageAccess);
        const accessibleMentions = newMentions.filter((m) => usersWithAccess.has(m.userId));
        if (accessibleMentions.length === 0)
            return;
        const mentionsByCreator = new Map();
        for (const m of accessibleMentions) {
            const list = mentionsByCreator.get(m.creatorId) || [];
            list.push({ userId: m.userId, mentionId: m.mentionId });
            mentionsByCreator.set(m.creatorId, list);
        }
        for (const [actorId, mentions] of mentionsByCreator) {
            await this.notifyMentionedUsers(mentions, actorId, pageId, spaceId, workspaceId, appUrl);
        }
    }
    async notifyMentionedUsers(mentions, actorId, pageId, spaceId, workspaceId, appUrl) {
        const context = await this.getPageContext(actorId, pageId, spaceId, appUrl);
        if (!context)
            return;
        const { actor, pageTitle, basePageUrl } = context;
        for (const { userId, mentionId } of mentions) {
            const notification = await this.notificationService.create({
                userId,
                workspaceId,
                type: notification_constants_1.NotificationType.PAGE_USER_MENTION,
                actorId,
                pageId,
                spaceId,
                data: { mentionId },
            });
            if (!notification)
                continue;
            const pageUrl = `${basePageUrl}`;
            const subject = `${actor.name} mentioned you in ${pageTitle}`;
            await this.notificationService.queueEmail(userId, notification.id, subject, (0, page_mention_email_1.PageMentionEmail)({ actorName: actor.name, pageTitle, pageUrl }), notification_constants_1.NotificationType.PAGE_USER_MENTION);
        }
    }
    async processPermissionGranted(data, appUrl) {
        const { userIds, pageId, spaceId, workspaceId, actorId, role } = data;
        if (userIds.length === 0)
            return;
        const usersWithSpaceAccess = await this.spaceMemberRepo.getUserIdsWithSpaceAccess(userIds, spaceId);
        if (usersWithSpaceAccess.size === 0)
            return;
        const context = await this.getPageContext(actorId, pageId, spaceId, appUrl);
        if (!context)
            return;
        const { actor, pageTitle, basePageUrl } = context;
        const accessLabel = role === 'writer' ? 'edit' : 'view';
        for (const userId of usersWithSpaceAccess) {
            const notification = await this.notificationService.create({
                userId,
                workspaceId,
                type: notification_constants_1.NotificationType.PAGE_PERMISSION_GRANTED,
                actorId,
                pageId,
                spaceId,
                data: { role },
            });
            if (!notification)
                continue;
            const subject = `${actor.name} gave you ${accessLabel} access to ${pageTitle}`;
            await this.notificationService.queueEmail(userId, notification.id, subject, (0, permission_granted_email_1.PermissionGrantedEmail)({
                actorName: actor.name,
                pageTitle,
                pageUrl: basePageUrl,
                accessLabel,
            }));
        }
    }
    async processPageUpdate(data, appUrl) {
        const { pageId, spaceId, workspaceId, actorIds } = data;
        const watcherIds = await this.watcherRepo.getPageUpdateRecipientIds(pageId, spaceId);
        if (watcherIds.length === 0)
            return;
        const actorSet = new Set(actorIds);
        const candidateIds = watcherIds.filter((id) => !actorSet.has(id));
        if (candidateIds.length === 0)
            return;
        const eligibleUsers = await this.getEligiblePageUpdateUsers(candidateIds);
        if (eligibleUsers.size === 0)
            return;
        const afterPrefs = [...eligibleUsers.keys()];
        const recentlyNotified = await this.notificationRepo.getRecentlyNotifiedUserIds(afterPrefs, pageId, notification_constants_1.NotificationType.PAGE_UPDATED, PAGE_UPDATE_COOLDOWN_HOURS);
        const afterCooldown = afterPrefs.filter((id) => !recentlyNotified.has(id));
        if (afterCooldown.length === 0)
            return;
        const usersWithSpaceAccess = await this.spaceMemberRepo.getUserIdsWithSpaceAccess(afterCooldown, spaceId);
        const usersWithPageAccess = await this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [
            ...usersWithSpaceAccess,
        ]);
        if (usersWithPageAccess.length === 0)
            return;
        const recipientIds = new Set(usersWithPageAccess);
        const actorId = actorIds[0];
        const context = await this.getPageContext(actorId, pageId, spaceId, appUrl);
        if (!context)
            return;
        const { actor, pageTitle, basePageUrl, spaceName } = context;
        for (const userId of recipientIds) {
            const notification = await this.notificationService.create({
                userId,
                workspaceId,
                type: notification_constants_1.NotificationType.PAGE_UPDATED,
                actorId,
                pageId,
                spaceId,
            });
            if (!notification)
                continue;
            const canSend = await this.rateLimiter.canSendEmail(userId);
            if (canSend) {
                await this.notificationService.queueEmail(userId, notification.id, `${actor.name} updated ${pageTitle}`, (0, page_update_email_1.PageUpdateEmail)({
                    userName: eligibleUsers.get(userId) ?? '',
                    actorName: actor.name,
                    pageTitle,
                    pageUrl: basePageUrl,
                    spaceName,
                }), notification_constants_1.NotificationType.PAGE_UPDATED);
            }
            else {
                const isFirst = await this.rateLimiter.addToDigest(userId, notification.id);
                if (isFirst) {
                    await this.scheduleDigest(userId, workspaceId);
                }
            }
        }
    }
    async getEligiblePageUpdateUsers(userIds) {
        if (userIds.length === 0)
            return new Map();
        const users = await this.db
            .selectFrom('users')
            .select(['id', 'name', 'settings'])
            .where('id', 'in', userIds)
            .where('deletedAt', 'is', null)
            .where('deactivatedAt', 'is', null)
            .execute();
        const eligible = new Map();
        for (const u of users) {
            const settings = u.settings;
            if (settings?.notifications?.['page.updated'] !== false) {
                eligible.set(u.id, u.name);
            }
        }
        return eligible;
    }
    async scheduleDigest(userId, workspaceId) {
        await this.notificationQueue
            .add(constants_1.QueueJob.PAGE_UPDATE_DIGEST, { userId, workspaceId }, { delay: DIGEST_DELAY_MS, removeOnComplete: true })
            .catch((err) => {
            this.logger.error(`Failed to schedule digest for ${userId}: ${err.message}`);
        });
    }
    async processDigest(userId, appUrl) {
        const notificationIds = await this.rateLimiter.popDigest(userId);
        if (notificationIds.length === 0)
            return;
        const [user, notifications] = await Promise.all([
            this.db
                .selectFrom('users')
                .select(['id', 'name'])
                .where('id', '=', userId)
                .executeTakeFirst(),
            this.db
                .selectFrom('notifications')
                .select(['id', 'pageId', 'actorId'])
                .where('id', 'in', notificationIds)
                .execute(),
        ]);
        if (!user || notifications.length === 0)
            return;
        const pageIds = [
            ...new Set(notifications.map((n) => n.pageId).filter(Boolean)),
        ];
        const actorIds = [
            ...new Set(notifications.map((n) => n.actorId).filter(Boolean)),
        ];
        const allPages = await this.db
            .selectFrom('pages')
            .innerJoin('spaces', 'spaces.id', 'pages.spaceId')
            .select([
            'pages.id',
            'pages.title',
            'pages.slugId',
            'pages.spaceId',
            'spaces.slug as spaceSlug',
        ])
            .where('pages.id', 'in', pageIds)
            .execute();
        if (allPages.length === 0)
            return;
        const spaceIds = [...new Set(allPages.map((p) => p.spaceId))];
        const accessibleSpaceIds = new Set();
        for (const spaceId of spaceIds) {
            const usersWithAccess = await this.spaceMemberRepo.getUserIdsWithSpaceAccess([userId], spaceId);
            if (usersWithAccess.has(userId))
                accessibleSpaceIds.add(spaceId);
        }
        const spaceFilteredPages = allPages.filter((p) => accessibleSpaceIds.has(p.spaceId));
        if (spaceFilteredPages.length === 0)
            return;
        const accessiblePageIds = new Set();
        for (const p of spaceFilteredPages) {
            const hasAccess = await this.pagePermissionRepo.getUserIdsWithPageAccess(p.id, [userId]);
            if (hasAccess.includes(userId))
                accessiblePageIds.add(p.id);
        }
        const pages = spaceFilteredPages.filter((p) => accessiblePageIds.has(p.id));
        if (pages.length === 0)
            return;
        const actors = actorIds.length > 0
            ? await this.db
                .selectFrom('users')
                .select(['id', 'name'])
                .where('id', 'in', actorIds)
                .execute()
            : [];
        const actorMap = new Map(actors.map((a) => [a.id, a.name]));
        const pageActors = new Map();
        for (const n of notifications) {
            if (!n.pageId || !n.actorId)
                continue;
            const names = pageActors.get(n.pageId) ?? new Set();
            const name = actorMap.get(n.actorId);
            if (name)
                names.add(name);
            pageActors.set(n.pageId, names);
        }
        const pageUpdates = pages.map((p) => ({
            title: (0, helpers_1.getPageTitle)(p.title),
            url: `${appUrl}/s/${p.spaceSlug}/p/${p.slugId}`,
            updatedBy: [...(pageActors.get(p.id) ?? [])],
        }));
        await this.notificationService.queueEmail(userId, notificationIds[0], `Your digest: ${pageUpdates.length} page ${pageUpdates.length === 1 ? 'update' : 'updates'}`, (0, page_update_digest_email_1.PageUpdateDigestEmail)({
            userName: user.name,
            pageUpdates,
            totalUpdates: pageUpdates.length,
        }), notification_constants_1.NotificationType.PAGE_UPDATED);
    }
    async getPageContext(actorId, pageId, spaceId, appUrl) {
        const [actor, page, space] = await Promise.all([
            this.db
                .selectFrom('users')
                .select(['id', 'name'])
                .where('id', '=', actorId)
                .executeTakeFirst(),
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
        if (!actor || !page || !space) {
            return null;
        }
        const basePageUrl = `${appUrl}/s/${space.slug}/p/${page.slugId}`;
        return {
            actor,
            pageTitle: (0, helpers_1.getPageTitle)(page.title),
            basePageUrl,
            spaceName: space.name,
        };
    }
};
exports.PageNotificationService = PageNotificationService;
exports.PageNotificationService = PageNotificationService = PageNotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __param(7, (0, bullmq_1.InjectQueue)(constants_1.QueueName.NOTIFICATION_QUEUE)),
    __metadata("design:paramtypes", [Object, notification_service_1.NotificationService,
        notification_repo_1.NotificationRepo,
        space_member_repo_1.SpaceMemberRepo,
        page_permission_repo_1.PagePermissionRepo,
        watcher_repo_1.WatcherRepo,
        page_update_email_rate_limiter_1.PageUpdateEmailRateLimiter,
        bullmq_2.Queue])
], PageNotificationService);
//# sourceMappingURL=page.notification.js.map