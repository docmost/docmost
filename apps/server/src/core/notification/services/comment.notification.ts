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
import { CommentMentionEmail } from '@docmost/transactional/emails/comment-mention-email';
import { CommentCreateEmail } from '@docmost/transactional/emails/comment-created-email';
import { CommentResolvedEmail } from '@docmost/transactional/emails/comment-resolved-email';
import { getPageTitle } from '../../../common/helpers';

@Injectable()
export class CommentNotificationService {
  private readonly logger = new Logger(CommentNotificationService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly notificationService: NotificationService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly watcherRepo: WatcherRepo,
  ) {}

  async processComment(data: ICommentNotificationJob, appUrl: string) {
    const {
      commentId,
      parentCommentId,
      pageId,
      spaceId,
      workspaceId,
      actorId,
      mentionedUserIds,
      notifyWatchers,
    } = data;

    const context = await this.getCommentContext(
      actorId,
      pageId,
      spaceId,
      commentId,
      appUrl,
    );
    if (!context) return;

    const { actor, pageTitle, pageUrl } = context;
    const notifiedUserIds = new Set<string>();
    notifiedUserIds.add(actorId);

    const recipientIds = parentCommentId
      ? await this.getThreadParticipantIds(parentCommentId)
      : notifyWatchers
        ? await this.watcherRepo.getPageWatcherIds(pageId)
        : [];

    const allCandidateIds = [
      ...new Set([...mentionedUserIds, ...recipientIds]),
    ];
    const usersWithAccess =
      await this.spaceMemberRepo.getUserIdsWithSpaceAccess(
        allCandidateIds,
        spaceId,
      );

    for (const userId of mentionedUserIds) {
      if (!usersWithAccess.has(userId)) continue;

      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.COMMENT_USER_MENTION,
        actorId,
        pageId,
        spaceId,
        commentId,
      });

      await this.notificationService.queueEmail(
        userId,
        notification.id,
        `${actor.name} mentioned you in a comment`,
        CommentMentionEmail({ actorName: actor.name, pageTitle, pageUrl }),
      );

      notifiedUserIds.add(userId);
    }

    for (const recipientId of recipientIds) {
      if (notifiedUserIds.has(recipientId)) continue;
      if (!usersWithAccess.has(recipientId)) continue;

      const notification = await this.notificationService.create({
        userId: recipientId,
        workspaceId,
        type: NotificationType.COMMENT_CREATED,
        actorId,
        pageId,
        spaceId,
        commentId,
      });

      await this.notificationService.queueEmail(
        recipientId,
        notification.id,
        `${actor.name} commented on ${pageTitle}`,
        CommentCreateEmail({ actorName: actor.name, pageTitle, pageUrl }),
      );
    }
  }

  async processResolved(data: ICommentResolvedNotificationJob, appUrl: string) {
    const {
      commentId,
      commentCreatorId,
      pageId,
      spaceId,
      workspaceId,
      actorId,
    } = data;

    if (commentCreatorId === actorId) return;

    const context = await this.getCommentContext(
      actorId,
      pageId,
      spaceId,
      commentId,
      appUrl,
    );
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

    await this.notificationService.queueEmail(
      commentCreatorId,
      notification.id,
      subject,
      CommentResolvedEmail({ actorName: actor.name, pageTitle, pageUrl }),
    );
  }

  private async getThreadParticipantIds(
    parentCommentId: string,
  ): Promise<string[]> {
    const participants = await this.db
      .selectFrom('comments')
      .select('creatorId')
      .where((eb) =>
        eb.or([
          eb('id', '=', parentCommentId),
          eb('parentCommentId', '=', parentCommentId),
        ]),
      )
      .execute();

    return [...new Set(participants.map((p) => p.creatorId))];
  }

  private async getCommentContext(
    actorId: string,
    pageId: string,
    spaceId: string,
    commentId: string,
    appUrl: string,
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
      return null;
    }

    const pageUrl = `${appUrl}/s/${space.slug}/p/${page.slugId}`;

    return { actor, pageTitle: getPageTitle(page.title), pageUrl };
  }
}
