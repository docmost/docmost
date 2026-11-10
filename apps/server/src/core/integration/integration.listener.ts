import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';

const TOKEN_REFRESH_SCHEDULER_ID = 'integration-token-refresh-scheduler';
const TOKEN_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class IntegrationListener implements OnApplicationBootstrap {
  private readonly logger = new Logger(IntegrationListener.name);

  constructor(
    @InjectQueue(QueueName.INTEGRATION_QUEUE)
    private readonly integrationQueue: Queue,
  ) {}

  async onApplicationBootstrap() {
    await this.integrationQueue.upsertJobScheduler(
      TOKEN_REFRESH_SCHEDULER_ID,
      { every: TOKEN_REFRESH_INTERVAL_MS },
      {
        name: QueueJob.INTEGRATION_TOKEN_REFRESH,
        data: {},
      },
    );
    this.logger.debug('Integration token refresh scheduler created');
  }
}
