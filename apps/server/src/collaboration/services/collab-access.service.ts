import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import { COLLAB_ACCESS_RECHECK_CHANNEL } from '../constants';

export type CollabAccessRecheck = {
  userIds?: string[];
  pageIds?: string[];
};

@Injectable()
export class CollabAccessService {
  private readonly logger = new Logger(CollabAccessService.name);

  constructor(
    private readonly redisService: RedisService,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  async recheckAccess(recheck: CollabAccessRecheck): Promise<void> {
    if (!recheck.userIds?.length && !recheck.pageIds?.length) return;
    // Refresh personal lists and inboxes that may already be open.
    this.notificationQueue
      .add(QueueJob.PAGE_TASKS_UPDATED, recheck)
      .catch((err) =>
        this.logger.error({ err }, 'Failed to refresh task access'),
      );
    // not awaited, ioredis queues the command and can hold the reply for minutes while redis reconnects
    try {
      this.redisService
        .getOrThrow()
        .publish(COLLAB_ACCESS_RECHECK_CHANNEL, JSON.stringify(recheck))
        .catch((err) => this.logError(err));
    } catch (err) {
      this.logError(err);
    }
  }

  private logError(err: unknown): void {
    this.logger.error({ err }, 'Failed to publish collab access recheck');
  }
}
