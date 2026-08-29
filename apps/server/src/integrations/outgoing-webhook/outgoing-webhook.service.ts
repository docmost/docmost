import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';
import { IOutgoingWebhookJob } from '../queue/constants/queue.interface';
import { OutgoingWebhookPayload } from './outgoing-webhook.types';

export function signOutgoingWebhook(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

@Injectable()
export class OutgoingWebhookService {
  constructor(private readonly environmentService: EnvironmentService) {}

  async deliver(job: IOutgoingWebhookJob): Promise<void> {
    const url = this.environmentService.getOutgoingWebhookUrl();
    const secret = this.environmentService.getOutgoingWebhookSecret();

    // Configuration can be removed while already queued deliveries remain.
    if (!url || !secret) return;

    const payload: OutgoingWebhookPayload = {
      version: '1',
      id: job.deliveryId,
      event: job.event as OutgoingWebhookPayload['event'],
      occurredAt: job.occurredAt,
      workspaceId: job.workspaceId,
      data: { pageId: job.pageId },
    };
    const body = JSON.stringify(payload);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Docmost-Webhook/1.0',
        'x-docmost-delivery': job.deliveryId,
        'x-docmost-event': job.event,
        'x-docmost-signature-256': signOutgoingWebhook(secret, body),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Outgoing webhook returned HTTP ${response.status}`);
    }
  }
}
