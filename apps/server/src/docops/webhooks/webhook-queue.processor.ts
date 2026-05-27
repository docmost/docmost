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
    const start = Date.now();

    let statusCode: number | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DocOps-Signature': signature,
          'X-DocOps-Event': event,
          'X-DocOps-Delivery': deliveryId,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      statusCode = response.status;
      const durationMs = Date.now() - start;

      if (!response.ok) {
        await this.logDelivery({
          webhookId, event, deliveryId,
          attemptNumber: (job.attemptsMade ?? 0) + 1,
          statusCode,
          errorMessage: `HTTP ${response.status}`,
          durationMs,
        });
        throw new Error(`Webhook ${webhookId} delivery failed: HTTP ${response.status}`);
      }

      await this.logDelivery({
        webhookId, event, deliveryId,
        attemptNumber: (job.attemptsMade ?? 0) + 1,
        statusCode,
        durationMs,
      });

      this.logger.debug(
        `Webhook ${webhookId} delivered (${event}, delivery ${deliveryId})`,
      );
    } catch (err: any) {
      const durationMs = Date.now() - start;
      if (statusCode === null) {
        // Network/timeout error — log hasn't been written yet
        await this.logDelivery({
          webhookId, event, deliveryId,
          attemptNumber: (job.attemptsMade ?? 0) + 1,
          statusCode: null,
          errorMessage: err?.message ?? 'Connection failed',
          durationMs,
        });
      }
      throw err;
    }
  }

  private async logDelivery(params: {
    webhookId: string;
    event: string;
    deliveryId: string;
    attemptNumber: number;
    statusCode?: number | null;
    errorMessage?: string | null;
    durationMs?: number;
  }): Promise<void> {
    try {
      await sql`
        INSERT INTO webhook_delivery_logs
          (webhook_id, event, delivery_id, attempt_number, status_code, error_message, duration_ms)
        VALUES
          (${params.webhookId}, ${params.event}, ${params.deliveryId}::uuid,
           ${params.attemptNumber}, ${params.statusCode ?? null},
           ${params.errorMessage ?? null}, ${params.durationMs ?? null})
      `.execute(this.db);
    } catch (logErr) {
      this.logger.error(`Failed to persist delivery log: ${logErr}`);
    }
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
