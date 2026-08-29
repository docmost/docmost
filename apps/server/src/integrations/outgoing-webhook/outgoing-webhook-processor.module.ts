import { Module } from '@nestjs/common';
import { OutgoingWebhookProcessor } from './outgoing-webhook.processor';
import { OutgoingWebhookService } from './outgoing-webhook.service';

@Module({
  providers: [OutgoingWebhookProcessor, OutgoingWebhookService],
})
export class OutgoingWebhookProcessorModule {}
