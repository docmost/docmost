import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { DOCOPS_WEBHOOK_QUEUE, WEBHOOK_DELIVER_JOB } from './webhooks.constants';

export interface WebhookJobData {
  webhookId: string;
  event: string;
  payload: Record<string, any>;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(DOCOPS_WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  async deliver(
    event: string,
    serviceId: string,
    crData: Record<string, any>,
  ): Promise<void> {
    const matchingWebhooks = await (this.db as any)
      .selectFrom('webhooks_config')
      .select('id')
      .where('is_active', '=', true)
      .where(sql`${event} = ANY(events)`)
      .where((eb: any) =>
        eb.or([eb('service_id', 'is', null), eb('service_id', '=', serviceId)]),
      )
      .execute();

    if (matchingWebhooks.length === 0) return;

    const payload: Record<string, any> = {
      event,
      timestamp: new Date().toISOString(),
      changeRequest: crData,
    };

    for (const webhook of matchingWebhooks) {
      await this.queue.add(
        WEBHOOK_DELIVER_JOB,
        { webhookId: webhook.id, event, payload } satisfies WebhookJobData,
        { attempts: 5 },
      );
      this.logger.debug(
        `Queued webhook ${webhook.id} for event ${event}`,
      );
    }
  }
}
