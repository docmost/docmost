import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  IApprovalClarificationNotificationJob,
  IPageReverificationRequiredNotificationJob,
} from '../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../../core/notification/notification.service';
import { NotificationType } from '../../core/notification/notification.constants';
import { ApprovalClarificationEmail } from '../../integrations/transactional/emails/approval-clarification-email';
import { ReverificationRequiredEmail } from '../../integrations/transactional/emails/reverification-required-email';
import { getPageTitle } from '../../common/helpers';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';

@Injectable()
export class ReviewNotificationService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly notificationService: NotificationService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  private async filterAccessibleRecipients(
    userIds: string[],
    pageId: string,
    spaceId: string,
  ): Promise<string[]> {
    if (userIds.length === 0) return [];
    const inSpace = await this.spaceMemberRepo.getUserIdsWithSpaceAccess(
      userIds,
      spaceId,
    );
    if (inSpace.size === 0) return [];
    return this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [
      ...inSpace,
    ]);
  }

  async processApprovalClarification(
    data: IApprovalClarificationNotificationJob,
    appUrl: string,
  ) {
    const { pageId, spaceId, workspaceId, actorId, requestedById } = data;

    const recipients = await this.filterAccessibleRecipients(
      [requestedById],
      pageId,
      spaceId,
    );
    if (recipients.length === 0) return;

    const context = await this.getPageContext(pageId, spaceId, appUrl);
    if (!context) return;

    const { pageTitle, spaceName, basePageUrl } = context;
    const actorName = await this.getUserName(actorId);

    const notification = await this.notificationService.create({
      userId: requestedById,
      workspaceId,
      type: NotificationType.PAGE_APPROVAL_CLARIFICATION_REQUESTED,
      actorId,
      pageId,
      spaceId,
    });

    if (!notification) return;

    const subject = `Clarification requested on "${pageTitle}"`;

    await this.notificationService.queueEmail(
      requestedById,
      notification.id,
      subject,
      ApprovalClarificationEmail({
        actorName,
        pageTitle,
        spaceName,
        pageUrl: basePageUrl,
      }),
    );
  }

  async processReverificationRequired(
    data: IPageReverificationRequiredNotificationJob,
    appUrl: string,
  ) {
    const { pageId, spaceId, workspaceId, verifierIds } = data;
    if (verifierIds.length === 0) return;

    const accessibleVerifierIds = await this.filterAccessibleRecipients(
      verifierIds,
      pageId,
      spaceId,
    );
    if (accessibleVerifierIds.length === 0) return;

    const context = await this.getPageContext(pageId, spaceId, appUrl);
    if (!context) return;

    const { pageTitle, spaceName, basePageUrl } = context;

    for (const userId of accessibleVerifierIds) {
      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_REVERIFICATION_REQUIRED,
        pageId,
        spaceId,
      });

      if (!notification) continue;

      const subject = `"${pageTitle}" needs to be re-verified`;

      await this.notificationService.queueEmail(
        userId,
        notification.id,
        subject,
        ReverificationRequiredEmail({
          pageTitle,
          spaceName,
          pageUrl: basePageUrl,
        }),
      );
    }
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
        .select(['id', 'slug', 'name'])
        .where('id', '=', spaceId)
        .executeTakeFirst(),
    ]);

    if (!page || !space) return null;

    const basePageUrl = `${appUrl}/s/${space.slug}/p/${page.slugId}`;
    return {
      pageTitle: getPageTitle(page.title),
      spaceName: space.name ?? space.slug,
      basePageUrl,
    };
  }
}
