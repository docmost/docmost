import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import {
  Integration,
  InsertableIntegration,
  UpdatableIntegration,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';

@Injectable()
export class IntegrationRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    integrationId: string,
    trx?: KyselyTransaction,
  ): Promise<Integration | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrations')
      .selectAll()
      .where('id', '=', integrationId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByWorkspaceAndType(
    workspaceId: string,
    type: string,
    trx?: KyselyTransaction,
  ): Promise<Integration | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrations')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('type', '=', type)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findEnabledByWorkspace(
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<Integration[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrations')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('isEnabled', '=', true)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async findAllByWorkspace(
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<Integration[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrations')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async insert(
    integration: InsertableIntegration,
    trx?: KyselyTransaction,
  ): Promise<Integration> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('integrations')
      .values(integration)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async insertOrRestore(
    integration: InsertableIntegration,
    trx?: KyselyTransaction,
  ): Promise<Integration> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('integrations')
      .values(integration)
      .onConflict((oc) =>
        oc.columns(['type', 'workspaceId']).doUpdateSet({
          deletedAt: null,
          isEnabled: true,
          installedById: integration.installedById,
          updatedAt: new Date(),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    integrationId: string,
    data: UpdatableIntegration,
    trx?: KyselyTransaction,
  ): Promise<Integration> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('integrations')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', integrationId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async softDelete(
    integrationId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('integrations')
      .set({ deletedAt: new Date() })
      .where('id', '=', integrationId)
      .execute();
  }
}
