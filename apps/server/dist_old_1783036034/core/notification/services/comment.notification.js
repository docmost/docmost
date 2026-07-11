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
var CommentNotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentNotificationService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_kysely_1 = require("nestjs-kysely");
const notification_service_1 = require("../notification.service");
const notification_constants_1 = require("../notification.constants");
const space_member_repo_1 = require("../../../database/repos/space/space-member.repo");
const page_permission_repo_1 = require("../../../database/repos/page/page-permission.repo");
const watcher_repo_1 = require("../../../database/repos/watcher/watcher.repo");
const comment_mention_email_1 = require("../../../integrations/transactional/emails/comment-mention-email");
const comment_created_email_1 = require("../../../integrations/transactional/emails/comment-created-email");
const comment_resolved_email_1 = require("../../../integrations/transactional/emails/comment-resolved-email");
const helpers_1 = require("../../../common/helpers");
let CommentNotificationService = CommentNotificationService_1 = class CommentNotificationService {
    constructor(db, notificationService, spaceMemberRepo, pagePermissionRepo, watcherRepo) {
        this.db = db;
        this.notificationService = notificationService;
        this.spaceMemberRepo = spaceMemberRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.watcherRepo = watcherRepo;
        this.logger = new common_1.Logger(CommentNotificationService_1.name);
    }
    async processComment(data, appUrl) {
        const { commentId, parentCommentId, pageId, spaceId, workspaceId, actorId, mentionedUserIds, notifyWatchers, } = data;
        const context = await this.getCommentContext(actorId, pageId, spaceId, commentId, appUrl);
        if (!context)
            return;
        const { actor, pageTitle, pageUrl } = context;
        const notifiedUserIds = new Set();
        notifiedUserIds.add(actorId);
        const recipientIds = parentCommentId
            ? await this.getThreadParticipantIds(parentCommentId)
            : notifyWatchers
                ? await this.watcherRepo.getPageWatcherIds(pageId)
                : [];
        const allCandidateIds = [
            ...new Set([...mentionedUserIds, ...recipientIds]),
        ];
        const usersWithSpaceAccess = await this.spaceMemberRepo.getUserIdsWithSpaceAccess(allCandidateIds, spaceId);
        const usersWithPageAccess = await this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [...usersWithSpaceAccess]);
        const usersWithAccess = new Set(usersWithPageAccess);
        for (const userId of mentionedUserIds) {
            if (!usersWithAccess.has(userId))
                continue;
            const notification = await this.notificationService.create({
                userId,
                workspaceId,
                type: notification_constants_1.NotificationType.COMMENT_USER_MENTION,
                actorId,
                pageId,
                spaceId,
                commentId,
            });
            if (!notification)
                continue;
            await this.notificationService.queueEmail(userId, notification.id, `${actor.name} mentioned you in a comment`, (0, comment_mention_email_1.CommentMentionEmail)({ actorName: actor.name, pageTitle, pageUrl }), notification_constants_1.NotificationType.COMMENT_USER_MENTION);
            notifiedUserIds.add(userId);
        }
        for (const recipientId of recipientIds) {
            if (notifiedUserIds.has(recipientId))
                continue;
            if (!usersWithAccess.has(recipientId))
                continue;
            const notification = await this.notificationService.create({
                userId: recipientId,
                workspaceId,
                type: notification_constants_1.NotificationType.COMMENT_CREATED,
                actorId,
                pageId,
                spaceId,
                commentId,
            });
            if (!notification)
                continue;
            await this.notificationService.queueEmail(recipientId, notification.id, `${actor.name} commented on ${pageTitle}`, (0, comment_created_email_1.CommentCreateEmail)({ actorName: actor.name, pageTitle, pageUrl }), notification_constants_1.NotificationType.COMMENT_CREATED);
        }
    }
    async processResolved(data, appUrl) {
        const { commentId, commentCreatorId, pageId, spaceId, workspaceId, actorId, } = data;
        if (commentCreatorId === actorId)
            return;
        const context = await this.getCommentContext(actorId, pageId, spaceId, commentId, appUrl);
        if (!context)
            return;
        const { actor, pageTitle, pageUrl } = context;
        const roles = await this.spaceMemberRepo.getUserSpaceRoles(commentCreatorId, spaceId);
        if (!roles) {
            this.logger.debug(`Skipping resolved notification for user ${commentCreatorId}: no access to space ${spaceId}`);
            return;
        }
        const hasPageAccess = await this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [commentCreatorId]);
        if (hasPageAccess.length === 0)
            return;
        const notification = await this.notificationService.create({
            userId: commentCreatorId,
            workspaceId,
            type: notification_constants_1.NotificationType.COMMENT_RESOLVED,
            actorId,
            pageId,
            spaceId,
            commentId,
        });
        if (!notification)
            return;
        const subject = `${actor.name} resolved a comment on ${pageTitle}`;
        await this.notificationService.queueEmail(commentCreatorId, notification.id, subject, (0, comment_resolved_email_1.CommentResolvedEmail)({ actorName: actor.name, pageTitle, pageUrl }), notification_constants_1.NotificationType.COMMENT_RESOLVED);
    }
    async getThreadParticipantIds(parentCommentId) {
        const participants = await this.db
            .selectFrom('comments')
            .select('creatorId')
            .where((eb) => eb.or([
            eb('id', '=', parentCommentId),
            eb('parentCommentId', '=', parentCommentId),
        ]))
            .execute();
        return [...new Set(participants.map((p) => p.creatorId))];
    }
    async getCommentContext(actorId, pageId, spaceId, commentId, appUrl) {
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
                .select(['id', 'slug'])
                .where('id', '=', spaceId)
                .executeTakeFirst(),
        ]);
        if (!actor || !page || !space) {
            return null;
        }
        const pageUrl = `${appUrl}/s/${space.slug}/p/${page.slugId}`;
        return { actor, pageTitle: (0, helpers_1.getPageTitle)(page.title), pageUrl };
    }
};
exports.CommentNotificationService = CommentNotificationService;
exports.CommentNotificationService = CommentNotificationService = CommentNotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object, notification_service_1.NotificationService,
        space_member_repo_1.SpaceMemberRepo,
        page_permission_repo_1.PagePermissionRepo,
        watcher_repo_1.WatcherRepo])
], CommentNotificationService);
//# sourceMappingURL=comment.notification.js.map