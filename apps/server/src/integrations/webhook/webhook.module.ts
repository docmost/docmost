import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookService } from './webhook.service';
import { WebhookProcessor } from './webhook.processor';
import { WebhookController } from './webhook.controller';
import { WebhookRepo } from '../../database/repos/webhook/webhook.repo';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'webhook-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
  ],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookProcessor, WebhookRepo],
  exports: [WebhookService],
})
export class WebhookModule {}
