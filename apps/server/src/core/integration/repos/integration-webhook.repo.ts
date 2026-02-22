import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import {
  IntegrationWebhook,
  InsertableIntegrationWebhook,
  UpdatableIntegrationWebhook,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';

@Injectable()
export class IntegrationWebhookRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    webhookId: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationWebhook | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationWebhooks')
      .selectAll()
      .where('id', '=', webhookId)
      .executeTakeFirst();
  }

  async findByIntegration(
    integrationId: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationWebhook[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationWebhooks')
      .selectAll()
      .where('integrationId', '=', integrationId)
      .execute();
  }

  async findEnabledByEvent(
    workspaceId: string,
    eventType: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationWebhook[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationWebhooks')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('eventType', '=', eventType)
      .where('isEnabled', '=', true)
      .execute();
  }

  async insert(
    webhook: InsertableIntegrationWebhook,
    trx?: KyselyTransaction,
  ): Promise<IntegrationWebhook> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('integrationWebhooks')
      .values(webhook)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    webhookId: string,
    data: UpdatableIntegrationWebhook,
    trx?: KyselyTransaction,
  ): Promise<IntegrationWebhook> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('integrationWebhooks')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', webhookId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(
    webhookId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('integrationWebhooks')
      .where('id', '=', webhookId)
      .execute();
  }

  async deleteByIntegration(
    integrationId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('integrationWebhooks')
      .where('integrationId', '=', integrationId)
      .execute();
  }
}
