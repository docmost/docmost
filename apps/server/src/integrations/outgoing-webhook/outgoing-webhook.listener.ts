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

// Database events are best-effort until their BullMQ insertion completes.
// Nest logs subscriber errors; webhook consumers must periodically reconcile
// source state to recover an event lost before durable queue insertion.
const pageEventOptions = { suppressErrors: true } as const;

@Injectable()
export class OutgoingWebhookListener {
  constructor(
    private readonly environmentService: EnvironmentService,
    @InjectQueue(QueueName.WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  @OnEvent(EventName.PAGE_CREATED, pageEventOptions)
  handleCreated(event: PageEvent) {
    return this.enqueue('page.created', event);
  }

  @OnEvent(EventName.PAGE_UPDATED, pageEventOptions)
  handleUpdated(event: PageEvent) {
    return this.enqueue('page.updated', event, 10_000);
  }

  @OnEvent(EventName.PAGE_MOVED_TO_SPACE, pageEventOptions)
  handleMoved(event: PageEvent) {
    return this.enqueue('page.moved', event);
  }

  @OnEvent(EventName.PAGE_SOFT_DELETED, pageEventOptions)
  handleSoftDeleted(event: PageEvent) {
    return this.enqueue('page.deleted', event);
  }

  @OnEvent(EventName.PAGE_DELETED, pageEventOptions)
  handleDeleted(event: PageEvent) {
    return this.enqueue('page.deleted', event);
  }

  @OnEvent(EventName.PAGE_RESTORED, pageEventOptions)
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
          deduplication:
            delay > 0
              ? {
                  id: `${eventName}-${pageId}`,
                  ttl: delay,
                  extend: true,
                  replace: true,
                }
              : undefined,
        });
      }),
    );
  }
}
