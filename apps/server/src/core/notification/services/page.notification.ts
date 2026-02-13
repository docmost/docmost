import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { IPageMentionNotificationJob } from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../notification.constants';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { PageMentionEmail } from '@docmost/transactional/emails/page-mention-email';

@Injectable()
export class PageNotificationService {
  private readonly logger = new Logger(PageNotificationService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly notificationService: NotificationService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly environmentService: EnvironmentService,
  ) {}

  async processPageMention(data: IPageMentionNotificationJob) {
    const { mentions, pageId, spaceId, workspaceId, actorId } = data;

    const context = await this.getPageContext(actorId, pageId, spaceId);
    if (!context) return;

    const { actor, pageTitle, basePageUrl } = context;

    for (const { userId, mentionId } of mentions) {
      const roles = await this.spaceMemberRepo.getUserSpaceRoles(
        userId,
        spaceId,
      );

      if (!roles) {
        this.logger.debug(
          `Skipping page mention notification for user ${userId}: no access to space ${spaceId}`,
        );
        continue;
      }

      const notification = await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.PAGE_USER_MENTION,
        actorId,
        pageId,
        spaceId,
      });

      const pageUrl = `${basePageUrl}?mentionId=${mentionId}`;
      const subject = `${actor.name} mentioned you in ${pageTitle}`;

      await this.notificationService.queueEmail(
        userId,
        notification.id,
        subject,
        PageMentionEmail({ actorName: actor.name, pageTitle, pageUrl }),
      );
    }
  }

  private async getPageContext(
    actorId: string,
    pageId: string,
    spaceId: string,
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
        `Missing data for page notification: actor=${!!actor} page=${!!page} space=${!!space}`,
      );
      return null;
    }

    const basePageUrl = `${this.environmentService.getAppUrl()}/s/${space.slug}/p/${page.slugId}`;

    return { actor, pageTitle: page.title || 'Untitled', basePageUrl };
  }

}
