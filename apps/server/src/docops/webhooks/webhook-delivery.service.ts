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
    const matchingWebhooks = await sql<{ id: string }>`
      SELECT id FROM webhooks_config
      WHERE is_active = true
        AND ${event} = ANY(events)
        AND (service_id IS NULL OR service_id = ${serviceId})
    `.execute(this.db);

    if (matchingWebhooks.rows.length === 0) return;

    const payload: Record<string, any> = {
      event,
      timestamp: new Date().toISOString(),
      changeRequest: crData,
    };

    for (const webhook of matchingWebhooks.rows) {
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
