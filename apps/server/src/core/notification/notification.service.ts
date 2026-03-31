import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { NotificationRepo } from '@docmost/db/repos/notification/notification.repo';
import { InsertableNotification } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { WsGateway } from '../../ws/ws.gateway';
import { MailService } from '../../integrations/mail/mail.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepo: NotificationRepo,
    private readonly wsGateway: WsGateway,
    private readonly mailService: MailService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async create(data: InsertableNotification) {
    const notification = await this.notificationRepo.insert(data);

    this.wsGateway.server
      .to(`user-${data.userId}`)
      .emit('notification', { id: notification.id, type: notification.type });

    return notification;
  }

  async findByUserId(userId: string, pagination: PaginationOptions) {
    return this.notificationRepo.findByUserId(userId, pagination);
  }

  async getUnreadCount(userId: string) {
    return this.notificationRepo.getUnreadCount(userId);
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.notificationRepo.markAsRead(notificationId, userId);
  }

  async markMultipleAsRead(notificationIds: string[], userId: string) {
    return this.notificationRepo.markMultipleAsRead(notificationIds, userId);
  }

  async markAllAsRead(userId: string) {
    return this.notificationRepo.markAllAsRead(userId);
  }

  async queueEmail(
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
