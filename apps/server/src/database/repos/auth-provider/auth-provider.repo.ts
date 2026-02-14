import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  AuthProvider,
  InsertableAuthProvider,
  UpdatableAuthProvider,
} from '@docmost/db/types/entity.types';

@Injectable()
export class AuthProviderRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    providerId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthProvider> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authProviders')
      .selectAll()
      .where('id', '=', providerId)
      .executeTakeFirst();
  }

  async findByWorkspaceId(workspaceId: string): Promise<AuthProvider[]> {
    return this.db
      .selectFrom('authProviders')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  async findEnabledByWorkspaceId(workspaceId: string): Promise<AuthProvider[]> {
    return this.db
      .selectFrom('authProviders')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('isEnabled', '=', true)
      .execute();
  }

  async insert(
    insertable: InsertableAuthProvider,
    trx?: KyselyTransaction,
  ): Promise<AuthProvider> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('authProviders')
      .values(insertable)
      .returningAll()
      .executeTakeFirst();
  }

  async update(
    providerId: string,
    updatable: UpdatableAuthProvider,
    trx?: KyselyTransaction,
  ): Promise<AuthProvider> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('authProviders')
      .set({ ...updatable, updatedAt: new Date() })
      .where('id', '=', providerId)
      .returningAll()
      .executeTakeFirst();
  }

  async delete(
    providerId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('authProviders')
      .where('id', '=', providerId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}
