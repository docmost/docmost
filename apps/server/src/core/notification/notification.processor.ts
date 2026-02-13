import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import {
  ICommentNotificationJob,
  ICommentResolvedNotificationJob,
  INotificationCreateJob,
} from '../../integrations/queue/constants/queue.interface';
import { NotificationService } from './notification.service';
import { CommentNotificationService } from './services/comment.notification';
import { JsonValue } from '@docmost/db/types/db';

@Processor(QueueName.NOTIFICATION_QUEUE)
export class NotificationProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly commentNotificationService: CommentNotificationService,
  ) {
    super();
  }

  async process(
    job: Job<
      | INotificationCreateJob
      | ICommentNotificationJob
      | ICommentResolvedNotificationJob,
      void
    >,
  ): Promise<void> {
    try {
      switch (job.name) {
        case QueueJob.NOTIFICATION_CREATE: {
          const {
            userId,
            workspaceId,
            type,
            actorId,
            pageId,
            spaceId,
            commentId,
            data,
          } = job.data as INotificationCreateJob;

          await this.notificationService.create({
            userId,
            workspaceId,
            type,
            actorId,
            pageId,
            spaceId,
            commentId,
            data: data as JsonValue,
          });

          this.logger.debug(
            `Created notification for user ${userId}: ${type}`,
          );
          break;
        }

        case QueueJob.COMMENT_NOTIFICATION: {
          await this.commentNotificationService.process(
            job.data as ICommentNotificationJob,
          );
          break;
        }

        case QueueJob.COMMENT_RESOLVED_NOTIFICATION: {
          await this.commentNotificationService.processResolved(
            job.data as ICommentResolvedNotificationJob,
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
