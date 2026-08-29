import { Module } from '@nestjs/common';
import { OutgoingWebhookListener } from './outgoing-webhook.listener';

@Module({
  providers: [OutgoingWebhookListener],
})
export class OutgoingWebhookModule {}
