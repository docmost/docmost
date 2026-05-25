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
