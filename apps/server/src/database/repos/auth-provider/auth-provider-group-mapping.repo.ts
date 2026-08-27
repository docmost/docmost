import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  AuthProviderGroupMapping,
  InsertableAuthProviderGroupMapping,
} from '@docmost/db/types/entity.types';

export type MappingWithGroupName = AuthProviderGroupMapping & {
  groupName: string;
};

@Injectable()
export class AuthProviderGroupMappingRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    id: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthProviderGroupMapping> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authProviderGroupMappings')
      .selectAll()
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findByWorkspace(
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<MappingWithGroupName[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authProviderGroupMappings as m')
      .innerJoin('groups as g', 'g.id', 'm.groupId')
      .selectAll('m')
      .select('g.name as groupName')
      .where('m.workspaceId', '=', workspaceId)
      .orderBy('m.createdAt', 'asc')
      .execute();
  }

  async findByProvider(
    authProviderId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthProviderGroupMapping[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authProviderGroupMappings')
      .selectAll()
      .where('authProviderId', '=', authProviderId)
      .execute();
  }

  async insert(
    insertable: InsertableAuthProviderGroupMapping,
    trx?: KyselyTransaction,
  ): Promise<AuthProviderGroupMapping> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('authProviderGroupMappings')
      .values(insertable)
      .onConflict((oc) =>
        oc
          .columns(['authProviderId', 'externalGroupKey', 'groupId'])
          .doUpdateSet((eb) => ({
            role: eb.ref('excluded.role'),
            updatedAt: new Date(),
          })),
      )
      .returningAll()
      .executeTakeFirst();
  }

  async delete(
    id: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('authProviderGroupMappings')
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async recordSyncResult(
    id: string,
    status: 'success' | 'error',
    error: string | null,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('authProviderGroupMappings')
      .set({
        lastSyncedAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: error,
        updatedAt: new Date(),
      })
      .where('id', '=', id)
      .execute();
  }
}
