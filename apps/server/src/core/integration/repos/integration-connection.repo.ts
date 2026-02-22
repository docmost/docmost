import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import {
  IntegrationConnection,
  InsertableIntegrationConnection,
  UpdatableIntegrationConnection,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';

@Injectable()
export class IntegrationConnectionRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    connectionId: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationConnections')
      .selectAll()
      .where('id', '=', connectionId)
      .executeTakeFirst();
  }

  async findByIntegrationAndUser(
    integrationId: string,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationConnections')
      .selectAll()
      .where('integrationId', '=', integrationId)
      .where('userId', '=', userId)
      .executeTakeFirst();
  }

  async findByWorkspaceTypeAndUser(
    workspaceId: string,
    integrationType: string,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationConnections')
      .innerJoin(
        'integrations',
        'integrations.id',
        'integrationConnections.integrationId',
      )
      .selectAll('integrationConnections')
      .where('integrations.workspaceId', '=', workspaceId)
      .where('integrations.type', '=', integrationType)
      .where('integrations.deletedAt', 'is', null)
      .where('integrationConnections.userId', '=', userId)
      .executeTakeFirst();
  }

  async findByIntegration(
    integrationId: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationConnections')
      .selectAll()
      .where('integrationId', '=', integrationId)
      .execute();
  }

  async upsert(
    connection: InsertableIntegrationConnection,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('integrationConnections')
      .values(connection)
      .onConflict((oc) =>
        oc.columns(['integrationId', 'userId']).doUpdateSet({
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
          tokenExpiresAt: connection.tokenExpiresAt,
          scopes: connection.scopes,
          providerUserId: connection.providerUserId,
          metadata: connection.metadata,
          updatedAt: new Date(),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    connectionId: string,
    data: UpdatableIntegrationConnection,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('integrationConnections')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', connectionId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async deleteByIntegrationAndUser(
    integrationId: string,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('integrationConnections')
      .where('integrationId', '=', integrationId)
      .where('userId', '=', userId)
      .execute();
  }

  async deleteByIntegration(
    integrationId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('integrationConnections')
      .where('integrationId', '=', integrationId)
      .execute();
  }
}
