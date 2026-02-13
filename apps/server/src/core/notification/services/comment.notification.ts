import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  ICommentNotificationJob,
  ICommentResolvedNotificationJob,
} from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../notification.constants';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { WatcherRepo } from '@docmost/db/repos/watcher/watcher.repo';
import { MailService } from '../../../integrations/mail/mail.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { CommentMentionEmail } from '@docmost/transactional/emails/comment-mention-email';
import { CommentCreateEmail } from '@docmost/transactional/emails/comment-created-email';
import { CommentResolvedEmail } from '@docmost/transactional/emails/comment-resolved-email';

@Injectable()
export class CommentNotificationService {
  private readonly logger = new Logger(CommentNotificationService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly notificationService: NotificationService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly watcherRepo: WatcherRepo,
    private readonly mailService: MailService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async process(data: ICommentNotificationJob) {
    const {
      commentId,
      pageId,
      spaceId,
      workspaceId,
      actorId,
      mentionedUserIds,
      notifyWatchers,
    } = data;

    const context = await this.getCommentContext(actorId, pageId, spaceId, commentId);
    if (!context) return;

    const { actor, pageTitle, pageUrl } = context;
    const notifiedUserIds = new Set<string>();
    notifiedUserIds.add(actorId);

    for (const userId of mentionedUserIds) {
      const roles = await this.spaceMemberRepo.getUserSpaceRoles(
        userId,
        spaceId,
      );

      if (!roles) {
        this.logger.debug(
          `Skipping mention notification for user ${userId}: no access to space ${spaceId}`,
        );
        continue;
      }

      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.COMMENT_USER_MENTION,
        actorId,
        pageId,
        spaceId,
        commentId,
      });

      await this.queueEmail(
        userId,
        notification.id,
        `${actor.name} mentioned you in a comment`,
        CommentMentionEmail({ actorName: actor.name, pageTitle, pageUrl }),
      );

      notifiedUserIds.add(userId);
    }

    if (!notifyWatchers) return;

    const watcherIds = await this.watcherRepo.getPageWatcherIds(pageId);

    for (const watcherId of watcherIds) {
      if (notifiedUserIds.has(watcherId)) continue;

      const notification = await this.notificationService.create({
        userId: watcherId,
        workspaceId,
        type: NotificationType.COMMENT_CREATED,
        actorId,
        pageId,
        spaceId,
        commentId,
      });

      await this.queueEmail(
        watcherId,
        notification.id,
        `${actor.name} commented on ${pageTitle}`,
        CommentCreateEmail({ actorName: actor.name, pageTitle, pageUrl }),
      );
    }
  }

  async processResolved(data: ICommentResolvedNotificationJob) {
    const { commentId, commentCreatorId, pageId, spaceId, workspaceId, actorId } = data;

    if (commentCreatorId === actorId) return;

    const context = await this.getCommentContext(actorId, pageId, spaceId, commentId);
    if (!context) return;

    const { actor, pageTitle, pageUrl } = context;

    const roles = await this.spaceMemberRepo.getUserSpaceRoles(
      commentCreatorId,
      spaceId,
    );

    if (!roles) {
      this.logger.debug(
        `Skipping resolved notification for user ${commentCreatorId}: no access to space ${spaceId}`,
      );
      return;
    }

    const notification = await this.notificationService.create({
      userId: commentCreatorId,
      workspaceId,
      type: NotificationType.COMMENT_RESOLVED,
      actorId,
      pageId,
      spaceId,
      commentId,
    });

    const subject = `${actor.name} resolved a comment on ${pageTitle}`;

    await this.queueEmail(
      commentCreatorId,
      notification.id,
      subject,
      CommentResolvedEmail({ actorName: actor.name, pageTitle, pageUrl }),
    );
  }

  private async getCommentContext(
    actorId: string,
    pageId: string,
    spaceId: string,
    commentId: string,
  ) {
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
      this.logger.warn(
        `Missing data for comment notification: actor=${!!actor} page=${!!page} space=${!!space}`,
      );
      return null;
    }

    const pageUrl = `${this.environmentService.getAppUrl()}/s/${space.slug}/p/${page.slugId}?commentId=${commentId}`;

    return { actor, pageTitle: page.title || 'Untitled', pageUrl };
  }

  private async queueEmail(
    userId: string,
    notificationId: string,
    subject: string,
    template: any,
  ) {
    try {
      const user = await this.db
        .selectFrom('users')
        .select(['email'])
        .where('id', '=', userId)
        .where('deletedAt', 'is', null)
        .executeTakeFirst();

      if (!user?.email) return;

      await this.mailService.sendToQueue({
        to: user.email,
        subject,
        template,
      });

      await this.notificationService.markAsEmailed(notificationId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Failed to send email for notification ${notificationId}: ${message}`,
      );
    }
  }
}
