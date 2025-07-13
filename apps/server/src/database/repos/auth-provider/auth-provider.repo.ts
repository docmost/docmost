import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { AuthProviders } from '@docmost/db/types/db';
import { dbOrTx } from '@docmost/db/utils';
import { InsertableAuthProvider, UpdatableAuthProvider, AuthProvider } from '@docmost/db/types/entity.types';

@Injectable()
export class AuthProviderRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  public baseFields: Array<keyof AuthProviders> = [
    'id',
    'name',
    'type',
    'samlUrl',
    'samlCertificate',
    'oidcIssuer',
    'oidcClientId',
    'oidcClientSecret',
    'allowSignup',
    'isEnabled',
    'creatorId',
    'workspaceId',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  async findOidcProvider(workspaceId: string, trx?: KyselyTransaction): Promise<AuthProvider | null> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authProviders')
      .select(this.baseFields)
      .where('workspaceId', '=', workspaceId)
      .where('type', '=', 'oidc')
      .where('isEnabled', '=', true)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findById(id: string, workspaceId: string, trx?: KyselyTransaction): Promise<AuthProvider | null> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authProviders')
      .select(this.baseFields)
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async create(data: InsertableAuthProvider, trx?: KyselyTransaction): Promise<AuthProvider> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('authProviders')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(id: string, workspaceId: string, data: UpdatableAuthProvider, trx?: KyselyTransaction): Promise<AuthProvider> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('authProviders')
      .set(data)
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(id: string, workspaceId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('authProviders')
      .set({ deletedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async findByWorkspace(workspaceId: string, trx?: KyselyTransaction): Promise<AuthProvider[]> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('authProviders')
      .select(this.baseFields)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }
}
