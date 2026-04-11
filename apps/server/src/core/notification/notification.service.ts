import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { NotificationRepo } from '@docmost/db/repos/notification/notification.repo';
import { InsertableNotification } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { WsGateway } from '../../ws/ws.gateway';
import { MailService } from '../../integrations/mail/mail.service';
import { NotificationTab, NotificationType, NotificationTypeToSettingKey } from './notification.constants';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepo: NotificationRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly wsGateway: WsGateway,
    private readonly mailService: MailService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  /**
   * Returns the subset of `ids` pointing to notifications the user can
   * currently see. Enforces the same dual gate as `findByUserId`:
   *   1. `spaceId IS NULL` or user is a current member of `spaceId`.
   *   2. `pageId IS NULL` or user has page-level access to `pageId`.
   *
   * Returning an empty array when `ids` is empty is a shortcut callers use to
   * make the mark/count paths no-ops.
   */
  private async filterAccessibleNotificationIds(
    ids: string[],
    userId: string,
  ): Promise<string[]> {
    if (ids.length === 0) return [];

    const rows = await this.db
      .selectFrom('notifications')
      .select(['id', 'pageId'])
      .where('id', 'in', ids)
      .where('userId', '=', userId)
      .where((eb) =>
        eb.or([
          eb('spaceId', 'is', null),
          eb(
            'spaceId',
            'in',
            this.spaceMemberRepo.getUserSpaceIdsQuery(userId),
          ),
        ]),
      )
      .execute();

    if (rows.length === 0) return [];

    const pageIds = rows
      .map((r) => r.pageId)
      .filter((p): p is string => !!p);

    if (pageIds.length === 0) {
      return rows.map((r) => r.id);
    }

    const accessiblePageIds =
      await this.pagePermissionRepo.filterAccessiblePageIds({
        pageIds,
        userId,
      });
    const accessibleSet = new Set(accessiblePageIds);

    return rows
      .filter((r) => !r.pageId || accessibleSet.has(r.pageId))
      .map((r) => r.id);
  }

  private async listUnreadAccessibleNotificationIds(
    userId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .selectFrom('notifications')
      .select(['id', 'pageId'])
      .where('userId', '=', userId)
      .where('readAt', 'is', null)
      .where((eb) =>
        eb.or([
          eb('spaceId', 'is', null),
          eb(
            'spaceId',
            'in',
            this.spaceMemberRepo.getUserSpaceIdsQuery(userId),
          ),
        ]),
      )
      .execute();

    if (rows.length === 0) return [];

    const pageIds = rows
      .map((r) => r.pageId)
      .filter((p): p is string => !!p);

    if (pageIds.length === 0) {
      return rows.map((r) => r.id);
    }

    const accessiblePageIds =
      await this.pagePermissionRepo.filterAccessiblePageIds({
        pageIds,
        userId,
      });
    const accessibleSet = new Set(accessiblePageIds);

    return rows
      .filter((r) => !r.pageId || accessibleSet.has(r.pageId))
      .map((r) => r.id);
  }

  async create(data: InsertableNotification) {
    const user = await this.db
      .selectFrom('users')
      .select(['id'])
      .where('id', '=', data.userId)
      .where('deletedAt', 'is', null)
      .where('deactivatedAt', 'is', null)
      .executeTakeFirst();

    if (!user) return null;

    const notification = await this.notificationRepo.insert(data);

    this.wsGateway.server
      .to(`user-${data.userId}`)
      .emit('notification', { id: notification.id, type: notification.type });

    return notification;
  }

  async findByUserId(
    userId: string,
    pagination: PaginationOptions,
    type: NotificationTab = 'all',
  ) {
    const result = await this.notificationRepo.findByUserId(
      userId,
      pagination,
      type,
    );

    const pageIds = result.items
      .map((n: any) => n.pageId)
      .filter(Boolean);

    if (pageIds.length > 0) {
      const accessiblePageIds =
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds,
          userId,
        });
      const accessibleSet = new Set(accessiblePageIds);

      result.items = result.items.filter(
        (n: any) => !n.pageId || accessibleSet.has(n.pageId),
      );
    }

    return result;
  }

  async getUnreadCount(userId: string) {
    const accessibleIds =
      await this.listUnreadAccessibleNotificationIds(userId);
    return accessibleIds.length;
  }

  async markAsRead(notificationId: string, userId: string) {
    const accessibleIds = await this.filterAccessibleNotificationIds(
      [notificationId],
      userId,
    );
    if (accessibleIds.length === 0) return;
    return this.notificationRepo.markAsRead(accessibleIds[0], userId);
  }

  async markMultipleAsRead(notificationIds: string[], userId: string) {
    const accessibleIds = await this.filterAccessibleNotificationIds(
      notificationIds,
      userId,
    );
    if (accessibleIds.length === 0) return;
    return this.notificationRepo.markMultipleAsRead(accessibleIds, userId);
  }

  async markAllAsRead(userId: string) {
    const accessibleIds =
      await this.listUnreadAccessibleNotificationIds(userId);
    if (accessibleIds.length === 0) return;
    return this.notificationRepo.markMultipleAsRead(accessibleIds, userId);
  }

  async queueEmail(
    userId: string,
    notificationId: string,
    subject: string,
    template: any,
    type?: NotificationType,
  ) {
    try {
      const user = await this.db
        .selectFrom('users')
        .select(['email', 'settings'])
        .where('id', '=', userId)
        .where('deletedAt', 'is', null)
        .where('deactivatedAt', 'is', null)
        .executeTakeFirst();

      if (!user?.email) return;

      if (type) {
        const settingKey = NotificationTypeToSettingKey[type];
        if (settingKey) {
          const settings = user.settings as any;
          if (settings?.notifications?.[settingKey] === false) return;
        }
      }

      await this.mailService.sendToQueue({
        to: user.email,
        subject,
        template,
        notificationId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Failed to queue email for notification ${notificationId}: ${message}`,
      );
    }
  }
}
