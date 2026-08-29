import { MODULE_METADATA } from '@nestjs/common/constants';
import { OutgoingWebhookModule } from './outgoing-webhook.module';
import { OutgoingWebhookProcessorModule } from './outgoing-webhook-processor.module';
import { OutgoingWebhookListener } from './outgoing-webhook.listener';
import { OutgoingWebhookProcessor } from './outgoing-webhook.processor';

describe('Outgoing webhook module topology', () => {
  it('keeps queue consumption out of the producer module', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      OutgoingWebhookModule,
    );

    expect(providers).toContain(OutgoingWebhookListener);
    expect(providers).not.toContain(OutgoingWebhookProcessor);
  });

  it('registers the queue consumer only in the processor module', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      OutgoingWebhookProcessorModule,
    );

    expect(providers).toContain(OutgoingWebhookProcessor);
  });
});
