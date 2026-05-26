import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User } from '@docmost/db/types/entity.types';
import { sql } from 'kysely';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { createHmac } from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async createWebhook(dto: CreateWebhookDto, authUser: User) {
    await this.assertAdmin(authUser.id);

    const webhook = await this.db
      .insertInto('webhooks_config' as any)
      .values({
        name: dto.name,
        url: dto.url,
        secret: dto.secret,
        events: dto.events,
        is_active: dto.isActive ?? true,
        service_id: dto.serviceId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.redactSecret(webhook);
  }

  async listWebhooks(authUser: User) {
    await this.assertAdmin(authUser.id);

    const rows = await this.db
      .selectFrom('webhooks_config' as any)
      .selectAll()
      .orderBy('created_at' as any, 'desc')
      .execute();

    return rows.map((r) => this.redactSecret(r));
  }

  async updateWebhook(dto: UpdateWebhookDto, authUser: User) {
    await this.assertAdmin(authUser.id);

    const existing = await this.db
      .selectFrom('webhooks_config' as any)
      .select(['id'])
      .where('id' as any, '=', dto.id)
      .executeTakeFirst();

    if (!existing) throw new NotFoundException('Webhook not found');

    const updates: Record<string, any> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.url !== undefined) updates.url = dto.url;
    if (dto.secret !== undefined) updates.secret = dto.secret;
    if (dto.events !== undefined) updates.events = dto.events;
    if (dto.isActive !== undefined) updates.is_active = dto.isActive;
    if (dto.serviceId !== undefined) updates.service_id = dto.serviceId;

    const webhook = await this.db
      .updateTable('webhooks_config' as any)
      .set(updates)
      .where('id' as any, '=', dto.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.redactSecret(webhook);
  }

  async deleteWebhook(id: string, authUser: User) {
    await this.assertAdmin(authUser.id);

    const existing = await this.db
      .selectFrom('webhooks_config' as any)
      .select(['id'])
      .where('id' as any, '=', id)
      .executeTakeFirst();

    if (!existing) throw new NotFoundException('Webhook not found');

    await this.db
      .deleteFrom('webhooks_config' as any)
      .where('id' as any, '=', id)
      .execute();
  }

  async listDeliveries(webhookId: string, authUser: User) {
    await this.assertAdmin(authUser.id);

    const result = await sql<{
      id: number;
      webhook_id: string;
      event: string;
      delivery_id: string;
      attempt_number: number;
      status_code: number | null;
      error_message: string | null;
      duration_ms: number | null;
      created_at: string;
    }>`
      SELECT id, webhook_id, event, delivery_id, attempt_number,
             status_code, error_message, duration_ms, created_at
      FROM webhook_delivery_logs
      WHERE webhook_id = ${webhookId}
      ORDER BY created_at DESC
      LIMIT 50
    `.execute(this.db);

    return result.rows;
  }

  async pingWebhook(webhookId: string, authUser: User) {
    await this.assertAdmin(authUser.id);

    const result = await sql<{
      id: string;
      url: string;
      secret: string;
      is_active: boolean;
    }>`
      SELECT id, url, secret, is_active FROM webhooks_config WHERE id = ${webhookId}
    `.execute(this.db);

    const webhook = result.rows[0];
    if (!webhook) throw new NotFoundException('Webhook not found');

    const payload = {
      event: 'cr.test',
      timestamp: new Date().toISOString(),
      message: 'DocOps webhook test ping',
    };

    const body = JSON.stringify(payload);
    const signature =
      'sha256=' + createHmac('sha256', webhook.secret).update(body).digest('hex');

    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DocOps-Signature-256': signature,
          'X-DocOps-Event': 'cr.test',
          'X-DocOps-Delivery': 'test-ping',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      statusCode = response.status;
    } catch (err: any) {
      errorMessage = err?.message ?? 'Connection failed';
    }

    return {
      webhookId,
      url: webhook.url,
      signature,
      payload,
      statusCode,
      success: statusCode !== null && statusCode >= 200 && statusCode < 300,
      errorMessage,
    };
  }

  private redactSecret(webhook: any) {
    const { secret: _secret, ...rest } = webhook;
    return { ...rest, secret: '***' };
  }

  private async assertAdmin(userId: string): Promise<void> {
    const result = await sql<{ docops_roles: string[] }>`
      SELECT docops_roles FROM users WHERE id = ${userId}
    `.execute(this.db);
    const roles: string[] = result.rows[0]?.docops_roles ?? [];
    if (!roles.includes('ADMIN')) {
      throw new ForbiddenException('Admin role required');
    }
  }
}
