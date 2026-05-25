import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookQueueProcessor } from './webhook-queue.processor';
import { DOCOPS_WEBHOOK_QUEUE } from './webhooks.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DOCOPS_WEBHOOK_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryService, WebhookQueueProcessor],
  exports: [WebhookDeliveryService],
})
export class DocopsWebhooksModule {}
