import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import {
  ICommentNotificationJob,
  ICommentResolvedNotificationJob,
  IPageMentionNotificationJob,
} from '../../integrations/queue/constants/queue.interface';
import { CommentNotificationService } from './services/comment.notification';
import { PageNotificationService } from './services/page.notification';
import { DomainService } from '../../integrations/environment/domain.service';

@Processor(QueueName.NOTIFICATION_QUEUE)
export class NotificationProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly commentNotificationService: CommentNotificationService,
    private readonly pageNotificationService: PageNotificationService,
    private readonly domainService: DomainService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {
    super();
  }

  async process(
    job: Job<
      | ICommentNotificationJob
      | ICommentResolvedNotificationJob
      | IPageMentionNotificationJob,
      void
    >,
  ): Promise<void> {
    try {
      const workspaceId = (job.data as { workspaceId: string }).workspaceId;
      const appUrl = await this.getWorkspaceUrl(workspaceId);

      switch (job.name) {
        case QueueJob.COMMENT_NOTIFICATION: {
          await this.commentNotificationService.processComment(
            job.data as ICommentNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.COMMENT_RESOLVED_NOTIFICATION: {
          await this.commentNotificationService.processResolved(
            job.data as ICommentResolvedNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_MENTION_NOTIFICATION: {
          await this.pageNotificationService.processPageMention(
            job.data as IPageMentionNotificationJob,
            appUrl,
          );
          break;
        }

        default:
          this.logger.warn(`Unknown notification job: ${job.name}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to process ${job.name}: ${message}`);
      throw err;
    }
  }

  private async getWorkspaceUrl(workspaceId: string): Promise<string> {
    const workspace = await this.db
      .selectFrom('workspaces')
      .select('hostname')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    return this.domainService.getUrl(workspace?.hostname);
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    this.logger.error(
      `Error processing ${job.name} job. Reason: ${job.failedReason}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
