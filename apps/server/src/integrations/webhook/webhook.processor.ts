import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhookRepo } from '../../database/repos/webhook/webhook.repo';
import {
  WebhookDeliveryJob,
  WebhookEvent,
  WebhookPayload,
} from './webhook.service';

const MAX_FAILURE_COUNT = 10;
const WEBHOOK_TIMEOUT_MS = 10000;

interface DiscordEmbed {
  embeds: Array<{
    title: string;
    description: string;
    url?: string;
    color: number;
    author?: {
      name: string;
      icon_url?: string;
    };
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
    timestamp?: string;
  }>;
}

@Processor('webhook-queue')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly webhookRepo: WebhookRepo) {
    super();
  }

  async process(job: Job<WebhookDeliveryJob>): Promise<void> {
    const { webhookId, url, format, payload } = job.data;

    try {
      const formattedPayload = this.formatPayload(format, payload);

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        WEBHOOK_TIMEOUT_MS,
      );

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Docmost-Webhook/1.0',
          },
          body: JSON.stringify(formattedPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Success - reset failure count
        await this.webhookRepo.resetFailureCount(webhookId);
        this.logger.log(`Webhook delivered successfully to ${url}`);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook delivery failed for ${webhookId}: ${message}`);

      // Increment failure count
      await this.webhookRepo.incrementFailureCount(webhookId);

      // Check if we should disable the webhook
      const webhook = await this.webhookRepo.findById(webhookId);
      if (webhook && webhook.failureCount >= MAX_FAILURE_COUNT) {
        await this.webhookRepo.disableWebhook(webhookId);
        this.logger.warn(
          `Webhook ${webhookId} disabled after ${MAX_FAILURE_COUNT} failures`,
        );
      }

      // Re-throw to let BullMQ handle retries
      throw err;
    }
  }

  private formatPayload(
    format: 'discord' | 'slack' | 'generic',
    payload: WebhookPayload,
  ): DiscordEmbed | WebhookPayload {
    switch (format) {
      case 'discord':
        return this.formatDiscordPayload(payload);
      case 'slack':
        return this.formatSlackPayload(payload);
      default:
        return payload;
    }
  }

  private formatDiscordPayload(payload: WebhookPayload): DiscordEmbed {
    return {
      embeds: [
        {
          title: this.getEventTitle(payload.event),
          description:
            payload.content || `Page: **${payload.page.title}**`,
          url: payload.page.url,
          color: this.getEventColor(payload.event),
          author: {
            name: payload.actor.name,
            icon_url: payload.actor.avatarUrl,
          },
          fields: [
            {
              name: 'Space',
              value: payload.space.name,
              inline: true,
            },
            {
              name: 'Page',
              value: payload.page.title,
              inline: true,
            },
          ],
          timestamp: payload.timestamp,
        },
      ],
    };
  }

  private formatSlackPayload(payload: WebhookPayload): object {
    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${this.getEventTitle(payload.event)}*\n${payload.content || `Page: <${payload.page.url}|${payload.page.title}>`}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*Space:* ${payload.space.name} | *Page:* ${payload.page.title} | *By:* ${payload.actor.name}`,
            },
          ],
        },
      ],
    };
  }

  private getEventTitle(event: WebhookEvent): string {
    switch (event) {
      case WebhookEvent.MENTION:
        return '📢 You were mentioned';
      case WebhookEvent.COMMENT:
        return '💬 New comment';
      case WebhookEvent.PAGE_UPDATE:
        return '📝 Page updated';
      case WebhookEvent.PAGE_DELETE:
        return '🗑️ Page deleted';
      default:
        return '🔔 Notification';
    }
  }

  private getEventColor(event: WebhookEvent): number {
    switch (event) {
      case WebhookEvent.MENTION:
        return 0x5865f2; // Discord blurple
      case WebhookEvent.COMMENT:
        return 0x57f287; // Green
      case WebhookEvent.PAGE_UPDATE:
        return 0xfee75c; // Yellow
      case WebhookEvent.PAGE_DELETE:
        return 0xed4245; // Red
      default:
        return 0x99aab5; // Gray
    }
  }
}
