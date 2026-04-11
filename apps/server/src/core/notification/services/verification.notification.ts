import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  IApprovalRejectedNotificationJob,
  IApprovalRequestedNotificationJob,
  IPageVerifiedNotificationJob,
  IVerificationExpiringNotificationJob,
  IVerificationExpiredNotificationJob,
} from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../notification.constants';
import { VerificationExpiringEmail } from '@docmost/transactional/emails/verification-expiring-email';
import { VerificationExpiredEmail } from '@docmost/transactional/emails/verification-expired-email';
import { ApprovalRequestedEmail } from '@docmost/transactional/emails/approval-requested-email';
import { ApprovalRejectedEmail } from '@docmost/transactional/emails/approval-rejected-email';
import { getPageTitle } from '../../../common/helpers';

@Injectable()
export class VerificationNotificationService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly notificationService: NotificationService,
  ) {}

  async processVerificationExpiring(
    data: IVerificationExpiringNotificationJob,
    appUrl: string,
  ) {
    const { verifierIds, pageId, spaceId, workspaceId, expiresAt } = data;
    if (verifierIds.length === 0) return;

    const context = await this.getPageContext(pageId, spaceId, appUrl);
    if (!context) return;

    const { pageTitle, basePageUrl } = context;

    for (const userId of verifierIds) {
      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_VERIFICATION_EXPIRING,
        pageId,
        spaceId,
        data: { expiresAt },
      });

      const subject = `"${pageTitle}" needs to be re-verified soon`;

      await this.notificationService.queueEmail(
        userId,
        notification.id,
        subject,
        VerificationExpiringEmail({
          pageTitle,
          pageUrl: basePageUrl,
          expiresAt: new Date(expiresAt).toLocaleDateString(),
        }),
      );
    }
  }

  async processVerificationExpired(
    data: IVerificationExpiredNotificationJob,
    appUrl: string,
  ) {
    const { verifierIds, pageId, spaceId, workspaceId } = data;
    if (verifierIds.length === 0) return;

    const context = await this.getPageContext(pageId, spaceId, appUrl);
    if (!context) return;

    const { pageTitle, basePageUrl } = context;

    for (const userId of verifierIds) {
      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_VERIFICATION_EXPIRED,
        pageId,
        spaceId,
      });

      const subject = `"${pageTitle}" verification has expired`;

      await this.notificationService.queueEmail(
        userId,
        notification.id,
        subject,
        VerificationExpiredEmail({
          pageTitle,
          pageUrl: basePageUrl,
        }),
      );
    }
  }

  async processPageVerified(data: IPageVerifiedNotificationJob) {
    const { verifierIds, pageId, spaceId, workspaceId, actorId } = data;
    if (verifierIds.length === 0) return;

    for (const userId of verifierIds) {
      await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_VERIFIED,
        actorId,
        pageId,
        spaceId,
      });
    }
  }

  async processApprovalRequested(
    data: IApprovalRequestedNotificationJob,
    appUrl: string,
  ) {
    const { verifierIds, pageId, spaceId, workspaceId, actorId } = data;
    if (verifierIds.length === 0) return;

    const context = await this.getPageContext(pageId, spaceId, appUrl);
    if (!context) return;

    const { pageTitle, basePageUrl } = context;
    const actorName = await this.getUserName(actorId);

    for (const userId of verifierIds) {
      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_APPROVAL_REQUESTED,
        actorId,
        pageId,
        spaceId,
      });

      const subject = `"${pageTitle}" needs your approval`;

      await this.notificationService.queueEmail(
        userId,
        notification.id,
        subject,
        ApprovalRequestedEmail({
          actorName,
          pageTitle,
          pageUrl: basePageUrl,
        }),
      );
    }
  }

  async processApprovalRejected(
    data: IApprovalRejectedNotificationJob,
    appUrl: string,
  ) {
    const { pageId, spaceId, workspaceId, actorId, requestedById, comment } =
      data;

    const context = await this.getPageContext(pageId, spaceId, appUrl);
    if (!context) return;

    const { pageTitle, basePageUrl } = context;
    const actorName = await this.getUserName(actorId);

    const notification = await this.notificationService.create({
      userId: requestedById,
      workspaceId,
      type: NotificationType.PAGE_APPROVAL_REJECTED,
      actorId,
      pageId,
      spaceId,
    });

    const subject = `"${pageTitle}" was returned for revision`;

    await this.notificationService.queueEmail(
      requestedById,
      notification.id,
      subject,
      ApprovalRejectedEmail({
        actorName,
        pageTitle,
        pageUrl: basePageUrl,
        comment,
      }),
    );
  }

  private async getUserName(userId: string): Promise<string> {
    const user = await this.db
      .selectFrom('users')
      .select('name')
      .where('id', '=', userId)
      .executeTakeFirst();
    return user?.name ?? 'Someone';
  }

  private async getPageContext(
    pageId: string,
    spaceId: string,
    appUrl: string,
  ) {
    const [page, space] = await Promise.all([
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

    if (!page || !space) return null;

    const basePageUrl = `${appUrl}/s/${space.slug}/p/${page.slugId}`;
    return { pageTitle: getPageTitle(page.title), basePageUrl };
  }
}
