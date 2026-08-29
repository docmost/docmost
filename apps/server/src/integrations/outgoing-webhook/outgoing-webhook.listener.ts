import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { EventName } from '../../common/events/event.contants';
import { EnvironmentService } from '../environment/environment.service';
import { QueueJob, QueueName } from '../queue/constants';
import { IOutgoingWebhookJob } from '../queue/constants/queue.interface';
import { OutgoingWebhookEvent } from './outgoing-webhook.types';

interface PageEvent {
  pageIds: string[];
  workspaceId?: string;
}

@Injectable()
export class OutgoingWebhookListener {
  constructor(
    private readonly environmentService: EnvironmentService,
    @InjectQueue(QueueName.WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  @OnEvent(EventName.PAGE_CREATED)
  handleCreated(event: PageEvent) {
    return this.enqueue('page.created', event);
  }

  @OnEvent(EventName.PAGE_UPDATED)
  handleUpdated(event: PageEvent) {
    return this.enqueue('page.updated', event, 10_000);
  }

  @OnEvent(EventName.PAGE_MOVED_TO_SPACE)
  handleMoved(event: PageEvent) {
    return this.enqueue('page.moved', event);
  }

  @OnEvent(EventName.PAGE_SOFT_DELETED)
  handleSoftDeleted(event: PageEvent) {
    return this.enqueue('page.deleted', event);
  }

  @OnEvent(EventName.PAGE_DELETED)
  handleDeleted(event: PageEvent) {
    return this.enqueue('page.deleted', event);
  }

  @OnEvent(EventName.PAGE_RESTORED)
  handleRestored(event: PageEvent) {
    return this.enqueue('page.restored', event);
  }

  private async enqueue(
    eventName: OutgoingWebhookEvent,
    event: PageEvent,
    delay = 0,
  ): Promise<void> {
    if (!this.environmentService.getOutgoingWebhookUrl()) return;
    if (
      !this.environmentService.getOutgoingWebhookEvents().includes(eventName)
    ) {
      return;
    }

    await Promise.all(
      event.pageIds.map((pageId) => {
        const occurredAt = new Date();
        const data: IOutgoingWebhookJob = {
          deliveryId: randomUUID(),
          event: eventName,
          occurredAt: occurredAt.toISOString(),
          workspaceId: event.workspaceId,
          pageId,
        };

        return this.webhookQueue.add(QueueJob.DELIVER_OUTGOING_WEBHOOK, data, {
          delay,
          // BullMQ custom job IDs must not contain colons.
          jobId:
            delay > 0
              ? `${eventName.replaceAll('.', '-')}-${pageId}-${Math.floor(occurredAt.getTime() / delay)}`
              : undefined,
        });
      }),
    );
  }
}
