import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants/queue.constants';
import { EventName } from '../../common/events/event.contants';

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

  @OnEvent(EventName.PAGE_CREATED)
  async onPageCreated(payload: any) {
    await this.integrationQueue.add(QueueJob.INTEGRATION_EVENT, {
      eventName: EventName.PAGE_CREATED,
      ...payload,
    });
  }

  @OnEvent(EventName.PAGE_UPDATED)
  async onPageUpdated(payload: any) {
    await this.integrationQueue.add(QueueJob.INTEGRATION_EVENT, {
      eventName: EventName.PAGE_UPDATED,
      ...payload,
    });
  }

  @OnEvent(EventName.PAGE_DELETED)
  async onPageDeleted(payload: any) {
    await this.integrationQueue.add(QueueJob.INTEGRATION_EVENT, {
      eventName: EventName.PAGE_DELETED,
      ...payload,
    });
  }
}
