import { Module } from '@nestjs/common';
import { OutgoingWebhookListener } from './outgoing-webhook.listener';
import { OutgoingWebhookProcessor } from './outgoing-webhook.processor';
import { OutgoingWebhookService } from './outgoing-webhook.service';

@Module({
  providers: [
    OutgoingWebhookListener,
    OutgoingWebhookProcessor,
    OutgoingWebhookService,
  ],
})
export class OutgoingWebhookModule {}
