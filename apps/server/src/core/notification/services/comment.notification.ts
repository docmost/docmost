import { Injectable, Logger } from '@nestjs/common';
import { ICommentNotificationJob } from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../notification.constants';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { WatcherRepo } from '@docmost/db/repos/watcher/watcher.repo';

@Injectable()
export class CommentNotificationService {
  private readonly logger = new Logger(CommentNotificationService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly watcherRepo: WatcherRepo,
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

      await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.COMMENT_USER_MENTION,
        actorId,
        pageId,
        spaceId,
        commentId,
      });

      notifiedUserIds.add(userId);
    }

    if (!notifyWatchers) return;

    const watcherIds = await this.watcherRepo.getPageWatcherIds(pageId);

    for (const watcherId of watcherIds) {
      if (notifiedUserIds.has(watcherId)) continue;

      await this.notificationService.create({
        userId: watcherId,
        workspaceId,
        type: NotificationType.COMMENT_NEW_COMMENT,
        actorId,
        pageId,
        spaceId,
        commentId,
      });
    }
  }
}
