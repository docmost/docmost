import {
  InsertableIntegrationConnection,
  IntegrationConnection,
  UpdatableIntegrationConnection,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';

// Per-user integration connections (OAuth tokens), keyed by
// (workspaceId, userId, provider) so any provider reuses this table.
@Injectable()
export class IntegrationConnectionRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByUserAndProvider(
    userId: string,
    workspaceId: string,
    provider: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationConnections')
      .selectAll()
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('provider', '=', provider)
      .executeTakeFirst();
  }

  async upsert(
    insertable: InsertableIntegrationConnection,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('integrationConnections')
      .values(insertable)
      .onConflict((oc) =>
        oc
          .columns(['workspaceId', 'userId', 'provider'])
          .doUpdateSet((eb) => ({
            accessToken: eb.ref('excluded.accessToken'),
            refreshToken: eb.ref('excluded.refreshToken'),
            expiresAt: eb.ref('excluded.expiresAt'),
            externalId: eb.ref('excluded.externalId'),
            externalName: eb.ref('excluded.externalName'),
            scope: eb.ref('excluded.scope'),
            metadata: eb.ref('excluded.metadata'),
            updatedAt: sql`now()`,
          })),
      )
      .returningAll()
      .executeTakeFirst();
  }

  async update(
    updatable: UpdatableIntegrationConnection,
    userId: string,
    workspaceId: string,
    provider: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('integrationConnections')
      .set(updatable)
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('provider', '=', provider)
      .execute();
  }

  async deleteByUserAndProvider(
    userId: string,
    workspaceId: string,
    provider: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('integrationConnections')
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .where('provider', '=', provider)
      .execute();
  }
}
