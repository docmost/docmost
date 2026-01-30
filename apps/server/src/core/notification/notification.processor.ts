import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { INotificationCreateJob } from '../../integrations/queue/constants/queue.interface';
import { NotificationService } from './notification.service';
import { JsonValue } from '@docmost/db/types/db';

@Processor(QueueName.GENERAL_QUEUE)
export class NotificationProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  async process(job: Job<INotificationCreateJob, void>): Promise<void> {
    if (job.name !== QueueJob.NOTIFICATION_CREATE) {
      return;
    }

    try {
      const { userId, workspaceId, type, actorId, pageId, spaceId, commentId, data } =
        job.data;

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

      this.logger.debug(`Created notification for user ${userId}: ${type}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to create notification: ${message}`);
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    if (job.name === QueueJob.NOTIFICATION_CREATE) {
      this.logger.error(
        `Error processing ${job.name} job. Reason: ${job.failedReason}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
