import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  AuthProvider,
  InsertableAuthProvider,
  UpdatableAuthProvider,
} from '@docmost/db/types/entity.types';

@Injectable()
export class OidcProviderRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private readonly baseFields = [
    'id',
    'workspaceId',
    'creatorId',
    'slug',
    'name',
    'type',
    'oidcIssuer',
    'oidcClientId',
    'oidcClientSecret',
    'oidcRedirectUri',
    'scopes',
    'domains',
    'autoJoinByEmail',
    'autoCreateUsers',
    'isEnabled',
    'lastUsedAt',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ] as const;

  async listByWorkspace(workspaceId: string): Promise<AuthProvider[]> {
    return this.db
      .selectFrom('authProviders')
      .select(this.baseFields)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  async listEnabledPublicByWorkspace(workspaceId: string) {
    return this.db
      .selectFrom('authProviders')
      .select(['id', 'name', 'slug', 'type'])
      .where('workspaceId', '=', workspaceId)
      .where('isEnabled', '=', true)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  async findById(
    id: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthProvider> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authProviders')
      .select(this.baseFields)
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findBySlug(
    slug: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<AuthProvider> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authProviders')
      .select(this.baseFields)
      .where('slug', '=', slug)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async countEnabledByWorkspace(
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);
    const row = await db
      .selectFrom('authProviders')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('workspaceId', '=', workspaceId)
      .where('isEnabled', '=', true)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    return Number(row?.count ?? 0);
  }

  async insertProvider(
    insertableAuthProvider: InsertableAuthProvider,
    trx?: KyselyTransaction,
  ): Promise<AuthProvider> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('authProviders')
      .values(insertableAuthProvider)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async updateProvider(
    id: string,
    workspaceId: string,
    updatableAuthProvider: UpdatableAuthProvider,
    trx?: KyselyTransaction,
  ): Promise<AuthProvider> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('authProviders')
      .set({ ...updatableAuthProvider, updatedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .returning(this.baseFields)
      .executeTakeFirst();
  }
}
