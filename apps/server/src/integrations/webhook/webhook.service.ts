import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  WebhookRepo,
  UserWebhook,
} from '../../database/repos/webhook/webhook.repo';

export enum WebhookEvent {
  MENTION = 'mention',
  COMMENT = 'comment',
  PAGE_UPDATE = 'page_update',
  PAGE_DELETE = 'page_delete',
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  workspace: { id: string; name: string };
  page: { id: string; title: string; url: string; slugId: string };
  space: { id: string; name: string; slug: string };
  actor: { id: string; name: string; avatarUrl?: string };
  content?: string;
}

export interface WebhookDeliveryJob {
  webhookId: string;
  url: string;
  format: 'discord' | 'slack' | 'generic';
  payload: WebhookPayload;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly webhookRepo: WebhookRepo,
    @InjectQueue('webhook-queue') private webhookQueue: Queue,
  ) {}

  async getUserWebhook(
    userId: string,
    workspaceId: string,
  ): Promise<UserWebhook | undefined> {
    return this.webhookRepo.findByUserAndWorkspace(userId, workspaceId);
  }

  async createOrUpdate(
    userId: string,
    workspaceId: string,
    dto: {
      url: string;
      format?: 'discord' | 'slack' | 'generic';
      enabled?: boolean;
      events?: string[];
    },
  ): Promise<UserWebhook> {
    return this.webhookRepo.upsert({
      userId,
      workspaceId,
      ...dto,
    });
  }

  async delete(userId: string, workspaceId: string): Promise<void> {
    return this.webhookRepo.delete(userId, workspaceId);
  }

  async queueDelivery(
    userId: string,
    workspaceId: string,
    payload: WebhookPayload,
  ): Promise<void> {
    try {
      const webhook = await this.getUserWebhook(userId, workspaceId);
      if (!webhook?.enabled) return;
      if (!webhook.events.includes(payload.event)) return;

      await this.webhookQueue.add('deliver', {
        webhookId: webhook.id,
        url: webhook.url,
        format: webhook.format,
        payload,
      } as WebhookDeliveryJob);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Failed to queue webhook for user ${userId}: ${message}`,
      );
    }
  }

  async sendTestWebhook(
    userId: string,
    workspaceId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const webhook = await this.getUserWebhook(userId, workspaceId);
    if (!webhook) {
      return { success: false, error: 'No webhook configured' };
    }

    const testPayload: WebhookPayload = {
      event: WebhookEvent.MENTION,
      timestamp: new Date().toISOString(),
      workspace: { id: workspaceId, name: 'Test Workspace' },
      page: {
        id: 'test-page-id',
        title: 'Test Page',
        url: '/test',
        slugId: 'test',
      },
      space: { id: 'test-space-id', name: 'Test Space', slug: 'test' },
      actor: { id: userId, name: 'Test User' },
      content: 'This is a test webhook notification from Docmost.',
    };

    await this.webhookQueue.add(
      'deliver',
      {
        webhookId: webhook.id,
        url: webhook.url,
        format: webhook.format,
        payload: testPayload,
      } as WebhookDeliveryJob,
      { priority: 1 }, // High priority for test
    );

    return { success: true };
  }
}
