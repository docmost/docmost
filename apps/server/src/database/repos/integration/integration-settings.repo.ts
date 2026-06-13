import {
  InsertableIntegrationSetting,
  IntegrationSetting,
  UpdatableIntegrationSetting,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';

// Workspace-level OAuth app config (client_id + encrypted client_secret),
// keyed by (workspaceId, provider). Set by admins; distinct from connections.
@Injectable()
export class IntegrationSettingsRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByWorkspaceAndProvider(
    workspaceId: string,
    provider: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationSetting | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationSettings')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('provider', '=', provider)
      .executeTakeFirst();
  }

  async upsert(
    insertable: InsertableIntegrationSetting,
    trx?: KyselyTransaction,
  ): Promise<IntegrationSetting> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('integrationSettings')
      .values(insertable)
      .onConflict((oc) =>
        oc.columns(['workspaceId', 'provider']).doUpdateSet((eb) => ({
          clientId: eb.ref('excluded.clientId'),
          clientSecret: eb.ref('excluded.clientSecret'),
          enabled: eb.ref('excluded.enabled'),
          updatedAt: sql`now()`,
        })),
      )
      .returningAll()
      .executeTakeFirst();
  }

  async deleteByWorkspaceAndProvider(
    workspaceId: string,
    provider: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('integrationSettings')
      .where('workspaceId', '=', workspaceId)
      .where('provider', '=', provider)
      .execute();
  }
}
