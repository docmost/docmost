import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { createHmac, randomUUID } from 'crypto';
import { DOCOPS_WEBHOOK_QUEUE, WEBHOOK_DELIVER_JOB } from './webhooks.constants';
import { WebhookJobData } from './webhook-delivery.service';

@Processor(DOCOPS_WEBHOOK_QUEUE)
export class WebhookQueueProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(WebhookQueueProcessor.name);

  constructor(@InjectKysely() private readonly db: KyselyDB) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    if (job.name !== WEBHOOK_DELIVER_JOB) return;

    const { webhookId, event, payload } = job.data;

    // Re-fetch webhook to get secret and verify it is still active
    const result = await sql<{
      url: string;
      secret: string;
      is_active: boolean;
    }>`
      SELECT url, secret, is_active FROM webhooks_config WHERE id = ${webhookId}
    `.execute(this.db);

    const webhook = result.rows[0];
    if (!webhook || !webhook.is_active) {
      this.logger.debug(`Webhook ${webhookId} not found or inactive — skipping`);
      return;
    }

    const body = JSON.stringify(payload);
    const signature =
      'sha256=' +
      createHmac('sha256', webhook.secret).update(body).digest('hex');
    const deliveryId = randomUUID();

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DocOps-Signature-256': signature,
        'X-DocOps-Event': event,
        'X-DocOps-Delivery': deliveryId,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(
        `Webhook ${webhookId} delivery failed: HTTP ${response.status}`,
      );
    }

    this.logger.debug(
      `Webhook ${webhookId} delivered (${event}, delivery ${deliveryId})`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job) {
    this.logger.error(
      `Webhook job ${job.id} failed (attempt ${job.attemptsMade}): ${job.failedReason}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Webhook job ${job.id} completed`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
