import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

export interface UserWebhook {
  id: string;
  userId: string;
  workspaceId: string;
  url: string;
  format: 'discord' | 'slack' | 'generic';
  enabled: boolean;
  events: string[];
  lastTriggeredAt: Date | null;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertableUserWebhook {
  userId: string;
  workspaceId: string;
  url: string;
  format?: 'discord' | 'slack' | 'generic';
  enabled?: boolean;
  events?: string[];
}

export interface UpdatableUserWebhook {
  url?: string;
  format?: 'discord' | 'slack' | 'generic';
  enabled?: boolean;
  events?: string[];
}

// Note: After running the migration, regenerate types with kysely-codegen
// The 'user_webhooks' table will be available as 'userWebhooks' in the DB type

@Injectable()
export class WebhookRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  // Use type assertion since kysely-codegen hasn't been run yet
  private get webhooksTable() {
    return this.db.selectFrom('user_webhooks' as any);
  }

  async findByUserAndWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<UserWebhook | undefined> {
    const result = await (this.db as any)
      .selectFrom('user_webhooks')
      .selectAll()
      .where('user_id', '=', userId)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();

    return result ? this.mapToUserWebhook(result) : undefined;
  }

  async findById(webhookId: string): Promise<UserWebhook | undefined> {
    const result = await (this.db as any)
      .selectFrom('user_webhooks')
      .selectAll()
      .where('id', '=', webhookId)
      .executeTakeFirst();

    return result ? this.mapToUserWebhook(result) : undefined;
  }

  async upsert(data: InsertableUserWebhook): Promise<UserWebhook> {
    const existing = await this.findByUserAndWorkspace(
      data.userId,
      data.workspaceId,
    );

    if (existing) {
      const result = await (this.db as any)
        .updateTable('user_webhooks')
        .set({
          url: data.url,
          format: data.format,
          enabled: data.enabled,
          events: JSON.stringify(data.events),
          updated_at: new Date(),
        })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirst();
      return this.mapToUserWebhook(result);
    }

    const result = await (this.db as any)
      .insertInto('user_webhooks')
      .values({
        user_id: data.userId,
        workspace_id: data.workspaceId,
        url: data.url,
        format: data.format ?? 'discord',
        enabled: data.enabled ?? true,
        events: JSON.stringify(data.events ?? ['mention', 'comment', 'page_update']),
      })
      .returningAll()
      .executeTakeFirst();
    return this.mapToUserWebhook(result);
  }

  async update(
    webhookId: string,
    data: UpdatableUserWebhook,
  ): Promise<UserWebhook | undefined> {
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (data.url !== undefined) updateData.url = data.url;
    if (data.format !== undefined) updateData.format = data.format;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.events !== undefined) updateData.events = JSON.stringify(data.events);

    const result = await (this.db as any)
      .updateTable('user_webhooks')
      .set(updateData)
      .where('id', '=', webhookId)
      .returningAll()
      .executeTakeFirst();

    return result ? this.mapToUserWebhook(result) : undefined;
  }

  async delete(userId: string, workspaceId: string): Promise<void> {
    await (this.db as any)
      .deleteFrom('user_webhooks')
      .where('user_id', '=', userId)
      .where('workspace_id', '=', workspaceId)
      .execute();
  }

  async incrementFailureCount(webhookId: string): Promise<void> {
    await (this.db as any)
      .updateTable('user_webhooks')
      .set((eb: any) => ({
        failure_count: eb('failure_count', '+', 1),
        updated_at: new Date(),
      }))
      .where('id', '=', webhookId)
      .execute();
  }

  async resetFailureCount(webhookId: string): Promise<void> {
    await (this.db as any)
      .updateTable('user_webhooks')
      .set({
        failure_count: 0,
        last_triggered_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', webhookId)
      .execute();
  }

  async disableWebhook(webhookId: string): Promise<void> {
    await (this.db as any)
      .updateTable('user_webhooks')
      .set({
        enabled: false,
        updated_at: new Date(),
      })
      .where('id', '=', webhookId)
      .execute();
  }

  private mapToUserWebhook(row: any): UserWebhook {
    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      url: row.url,
      format: row.format,
      enabled: row.enabled,
      events: typeof row.events === 'string' ? JSON.parse(row.events) : row.events,
      lastTriggeredAt: row.last_triggered_at,
      failureCount: row.failure_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
