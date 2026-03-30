import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  IPageMentionNotificationJob,
  IPageUpdateNotificationJob,
  IPermissionGrantedNotificationJob,
} from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../notification.constants';
import { NotificationRepo } from '@docmost/db/repos/notification/notification.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { WatcherRepo } from '@docmost/db/repos/watcher/watcher.repo';
import { PageUpdateEmailRateLimiter } from './page-update-email-rate-limiter';
import { PageMentionEmail } from '@docmost/transactional/emails/page-mention-email';
import { PageUpdateEmail } from '@docmost/transactional/emails/page-update-email';
import { PageUpdateDigestEmail } from '@docmost/transactional/emails/page-update-digest-email';
import { PermissionGrantedEmail } from '@docmost/transactional/emails/permission-granted-email';
import { getPageTitle } from '../../../common/helpers';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';

const PAGE_UPDATE_COOLDOWN_HOURS = 7;
const DIGEST_DELAY_MS = 3 * 60 * 60 * 1000; // 3 hours

@Injectable()
export class PageNotificationService {
  private readonly logger = new Logger(PageNotificationService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly notificationService: NotificationService,
    private readonly notificationRepo: NotificationRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly watcherRepo: WatcherRepo,
    private readonly rateLimiter: PageUpdateEmailRateLimiter,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE) private notificationQueue: Queue,
  ) {}

  async processPageMention(data: IPageMentionNotificationJob, appUrl: string) {
    const { userMentions, oldMentionedUserIds, pageId, spaceId, workspaceId } =
      data;

    const oldIds = new Set(oldMentionedUserIds);
    const newMentions = userMentions.filter(
      (m) => !oldIds.has(m.userId) && m.creatorId !== m.userId,
    );

    if (newMentions.length === 0) return;

    const candidateUserIds = newMentions.map((m) => m.userId);
    const usersWithSpaceAccess =
      await this.spaceMemberRepo.getUserIdsWithSpaceAccess(
        candidateUserIds,
        spaceId,
      );

    const usersWithPageAccess =
      await this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [
        ...usersWithSpaceAccess,
      ]);
    const usersWithAccess = new Set(usersWithPageAccess);

    const accessibleMentions = newMentions.filter((m) =>
      usersWithAccess.has(m.userId),
    );
    if (accessibleMentions.length === 0) return;

    const mentionsByCreator = new Map<
      string,
      { userId: string; mentionId: string }[]
    >();
    for (const m of accessibleMentions) {
      const list = mentionsByCreator.get(m.creatorId) || [];
      list.push({ userId: m.userId, mentionId: m.mentionId });
      mentionsByCreator.set(m.creatorId, list);
    }

    for (const [actorId, mentions] of mentionsByCreator) {
      await this.notifyMentionedUsers(
        mentions,
        actorId,
        pageId,
        spaceId,
        workspaceId,
        appUrl,
      );
    }
  }

  private async notifyMentionedUsers(
    mentions: { userId: string; mentionId: string }[],
    actorId: string,
    pageId: string,
    spaceId: string,
    workspaceId: string,
    appUrl: string,
  ) {
    const context = await this.getPageContext(actorId, pageId, spaceId, appUrl);
    if (!context) return;

    const { actor, pageTitle, basePageUrl } = context;

    for (const { userId, mentionId } of mentions) {
      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_USER_MENTION,
        actorId,
        pageId,
        spaceId,
        data: { mentionId },
      });
      if (!notification) continue;

      const pageUrl = `${basePageUrl}`;
      const subject = `${actor.name} mentioned you in ${pageTitle}`;

      await this.notificationService.queueEmail(
        userId,
        notification.id,
        subject,
        PageMentionEmail({ actorName: actor.name, pageTitle, pageUrl }),
        NotificationType.PAGE_USER_MENTION,
      );
    }
  }

  async processPermissionGranted(
    data: IPermissionGrantedNotificationJob,
    appUrl: string,
  ) {
    const { userIds, pageId, spaceId, workspaceId, actorId, role } = data;

    if (userIds.length === 0) return;

    const usersWithSpaceAccess =
      await this.spaceMemberRepo.getUserIdsWithSpaceAccess(userIds, spaceId);

    if (usersWithSpaceAccess.size === 0) return;

    const context = await this.getPageContext(actorId, pageId, spaceId, appUrl);
    if (!context) return;

    const { actor, pageTitle, basePageUrl } = context;
    const accessLabel = role === 'writer' ? 'edit' : 'view';

    for (const userId of usersWithSpaceAccess) {
      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_PERMISSION_GRANTED,
        actorId,
        pageId,
        spaceId,
        data: { role },
      });
      if (!notification) continue;

      const subject = `${actor.name} gave you ${accessLabel} access to ${pageTitle}`;

      await this.notificationService.queueEmail(
        userId,
        notification.id,
        subject,
        PermissionGrantedEmail({
          actorName: actor.name,
          pageTitle,
          pageUrl: basePageUrl,
          accessLabel,
        }),
      );
    }
  }

  async processPageUpdate(data: IPageUpdateNotificationJob, appUrl: string) {
    const { pageId, spaceId, workspaceId, actorIds } = data;

    const watcherIds = await this.watcherRepo.getPageWatcherIds(pageId);
    if (watcherIds.length === 0) return;

    const actorSet = new Set(actorIds);
    const candidateIds = watcherIds.filter((id) => !actorSet.has(id));
    if (candidateIds.length === 0) return;

    const afterPrefs = await this.getEligiblePageUpdateUserIds(candidateIds);
    if (afterPrefs.length === 0) return;

    const recentlyNotified =
      await this.notificationRepo.getRecentlyNotifiedUserIds(
        afterPrefs,
        pageId,
        NotificationType.PAGE_UPDATED,
        PAGE_UPDATE_COOLDOWN_HOURS,
      );
    const afterCooldown = afterPrefs.filter((id) => !recentlyNotified.has(id));
    if (afterCooldown.length === 0) return;

    const usersWithSpaceAccess =
      await this.spaceMemberRepo.getUserIdsWithSpaceAccess(
        afterCooldown,
        spaceId,
      );

    const usersWithPageAccess =
      await this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [
        ...usersWithSpaceAccess,
      ]);
    if (usersWithPageAccess.length === 0) return;

    const recipientIds = new Set(usersWithPageAccess);
    const actorId = actorIds[0];

    const context = await this.getPageContext(actorId, pageId, spaceId, appUrl);
    if (!context) return;

    const { actor, pageTitle, basePageUrl } = context;

    for (const userId of recipientIds) {
      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_UPDATED,
        actorId,
        pageId,
        spaceId,
      });
      if (!notification) continue;

      const canSend = await this.rateLimiter.canSendEmail(userId);
      if (canSend) {
        await this.notificationService.queueEmail(
          userId,
          notification.id,
          `${actor.name} updated ${pageTitle}`,
          PageUpdateEmail({
            actorName: actor.name,
            pageTitle,
            pageUrl: basePageUrl,
          }),
          NotificationType.PAGE_UPDATED,
        );
      } else {
        const isFirst = await this.rateLimiter.addToDigest(
          userId,
          notification.id,
        );
        if (isFirst) {
          await this.scheduleDigest(userId, workspaceId);
        }
      }
    }
  }

  private async getEligiblePageUpdateUserIds(
    userIds: string[],
  ): Promise<string[]> {
    if (userIds.length === 0) return [];

    const users = await this.db
      .selectFrom('users')
      .select(['id', 'settings'])
      .where('id', 'in', userIds)
      .where('deletedAt', 'is', null)
      .where('deactivatedAt', 'is', null)
      .execute();

    return users
      .filter((u) => {
        const settings = u.settings as any;
        return settings?.notifications?.['page.updated'] !== false;
      })
      .map((u) => u.id);
  }

  private async scheduleDigest(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const jobId = `page-update-digest:${userId}`;
    await this.notificationQueue
      .add(
        QueueJob.PAGE_UPDATE_DIGEST,
        { userId, workspaceId },
        { jobId, delay: DIGEST_DELAY_MS },
      )
      .catch((err) => {
        this.logger.error(
          `Failed to schedule digest for ${userId}: ${err.message}`,
        );
      });
  }

  async processDigest(userId: string, appUrl: string): Promise<void> {
    const notificationIds = await this.rateLimiter.popDigest(userId);
    if (notificationIds.length === 0) return;

    const notifications = await this.db
      .selectFrom('notifications')
      .select(['id', 'pageId'])
      .where('id', 'in', notificationIds)
      .execute();

    if (notifications.length === 0) return;

    const pageIds = [...new Set(notifications.map((n) => n.pageId).filter(Boolean))];

    const pages = await this.db
      .selectFrom('pages')
      .innerJoin('spaces', 'spaces.id', 'pages.spaceId')
      .select([
        'pages.id',
        'pages.title',
        'pages.slugId',
        'spaces.slug as spaceSlug',
      ])
      .where('pages.id', 'in', pageIds)
      .execute();

    const pageUpdates = pages.map((p) => ({
      title: getPageTitle(p.title),
      url: `${appUrl}/s/${p.spaceSlug}/p/${p.slugId}`,
    }));

    if (pageUpdates.length === 0) return;

    await this.notificationService.queueEmail(
      userId,
      notificationIds[0],
      `${pageUpdates.length} pages were updated`,
      PageUpdateDigestEmail({ pageUpdates }),
      NotificationType.PAGE_UPDATED,
    );
  }

  private async getPageContext(
    actorId: string,
    pageId: string,
    spaceId: string,
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

    const basePageUrl = `${appUrl}/s/${space.slug}/p/${page.slugId}`;

    return { actor, pageTitle: getPageTitle(page.title), basePageUrl };
  }
}
