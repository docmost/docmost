import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants/queue.constants';
import { EventName } from '../../common/events/event.contants';

@Injectable()
export class IntegrationListener {
  constructor(
    @InjectQueue(QueueName.INTEGRATION_QUEUE)
    private readonly integrationQueue: Queue,
  ) {}

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
