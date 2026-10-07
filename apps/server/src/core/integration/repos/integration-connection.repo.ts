import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import {
  IntegrationConnection,
  InsertableIntegrationConnection,
  UpdatableIntegrationConnection,
} from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';

type ExpectedTokens = Partial<
  Pick<IntegrationConnection, 'accessToken' | 'refreshToken'>
>;

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
      .where('kind', '=', 'user')
      .executeTakeFirst();
  }

  async upsert(
    connection: InsertableIntegrationConnection,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection> {
    const db = dbOrTx(this.db, trx);
    // The unique index is partial on kind='user', so ON CONFLICT must repeat the predicate.
    return db
      .insertInto('integrationConnections')
      .values(connection)
      .onConflict((oc) =>
        oc
          .columns(['integrationId', 'userId'])
          .where(sql.ref('kind'), '=', 'user')
          .doUpdateSet({
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            tokenExpiresAt: connection.tokenExpiresAt,
            invalidatedAt: null,
            scopes: connection.scopes,
            providerUserId: connection.providerUserId,
            metadata: connection.metadata,
            updatedAt: new Date(),
          }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async upsertWorkspaceConnection(
    input: {
      integrationId: string;
      userId: string;
      workspaceId: string;
      accessToken: string;
      refreshToken?: string | null;
      tokenExpiresAt?: Date | null;
      scopes?: string | null;
    },
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection> {
    const db = dbOrTx(this.db, trx);

    const existing = await this.findWorkspaceConnection(input.integrationId, trx);
    if (existing) {
      return this.update(
        existing.id,
        {
          accessToken: input.accessToken,
          refreshToken: input.refreshToken ?? null,
          tokenExpiresAt: input.tokenExpiresAt ?? null,
          invalidatedAt: null,
          scopes: input.scopes ?? null,
          userId: input.userId,
        },
        trx,
      );
    }

    return db
      .insertInto('integrationConnections')
      .values({
        integrationId: input.integrationId,
        userId: input.userId,
        workspaceId: input.workspaceId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? null,
        tokenExpiresAt: input.tokenExpiresAt ?? null,
        scopes: input.scopes ?? null,
        kind: 'workspace',
      })
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
  ): Promise<boolean> {
    const db = dbOrTx(this.db, trx);
    // The shared workspace row carries the installer's userId; a personal disconnect must not delete it.
    const result = await db
      .deleteFrom('integrationConnections')
      .where('integrationId', '=', integrationId)
      .where('userId', '=', userId)
      .where('kind', '=', 'user')
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }

  async findByUserAndWorkspace(
    userId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationConnections')
      .innerJoin(
        'integrations',
        'integrations.id',
        'integrationConnections.integrationId',
      )
      .select([
        'integrationConnections.integrationId',
        'integrations.type',
        'integrationConnections.providerUserId',
        'integrationConnections.metadata',
        'integrationConnections.createdAt',
        'integrationConnections.invalidatedAt',
      ])
      .where('integrationConnections.userId', '=', userId)
      // Skip the workspace bot row, which carries the installer's userId.
      .where('integrationConnections.kind', '=', 'user')
      .where('integrations.workspaceId', '=', workspaceId)
      .where('integrations.deletedAt', 'is', null)
      .execute();
  }

  async findExpiringTokens(
    expiresBeforeMs: number,
    limit: number,
  ): Promise<IntegrationConnection[]> {
    const threshold = new Date(Date.now() + expiresBeforeMs);
    return this.db
      .selectFrom('integrationConnections')
      .innerJoin(
        'integrations',
        'integrations.id',
        'integrationConnections.integrationId',
      )
      .innerJoin('users', 'users.id', 'integrationConnections.userId')
      .selectAll('integrationConnections')
      .where('integrations.deletedAt', 'is', null)
      // The workspace bot row carries its installer's userId and must outlive them.
      .where((eb) =>
        eb.or([
          eb('integrationConnections.kind', '=', 'workspace'),
          eb.and([
            eb('users.deactivatedAt', 'is', null),
            eb('users.deletedAt', 'is', null),
          ]),
        ]),
      )
      .where('integrationConnections.invalidatedAt', 'is', null)
      .where('integrationConnections.refreshToken', 'is not', null)
      .where('integrationConnections.tokenExpiresAt', 'is not', null)
      .where('integrationConnections.tokenExpiresAt', '<', threshold)
      .orderBy('integrationConnections.tokenExpiresAt', 'asc')
      .limit(limit)
      .execute();
  }

  async updateIfTokensMatch(
    connectionId: string,
    expected: ExpectedTokens,
    data: UpdatableIntegrationConnection,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    let query = db
      .updateTable('integrationConnections')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', connectionId);
    if (expected.accessToken !== undefined) {
      query = query.where('accessToken', '=', expected.accessToken);
    }
    if (expected.refreshToken !== undefined) {
      query = query.where('refreshToken', '=', expected.refreshToken);
    }
    await query.execute();
  }

  async invalidate(
    connectionId: string,
    expected: ExpectedTokens = {},
    trx?: KyselyTransaction,
  ): Promise<void> {
    await this.updateIfTokensMatch(
      connectionId,
      expected,
      { invalidatedAt: new Date(), refreshToken: null, tokenExpiresAt: null },
      trx,
    );
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

  // Leaves the workspace bot row a departing user installed.
  async deleteUserConnections(
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('integrationConnections')
      .where('userId', '=', userId)
      .where('kind', '=', 'user')
      .execute();
  }

  async findWorkspaceConnection(
    integrationId: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationConnections')
      .selectAll()
      .where('integrationId', '=', integrationId)
      .where('kind', '=', 'workspace')
      .executeTakeFirst();
  }

  async findUserLink(
    integrationId: string,
    providerUserId: string,
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('integrationConnections')
      .selectAll()
      .where('integrationId', '=', integrationId)
      .where('providerUserId', '=', providerUserId)
      .where('kind', '=', 'user')
      .executeTakeFirst();
  }

  async findUserLinkByUserId(
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
      .where('kind', '=', 'user')
      .executeTakeFirst();
  }

  async deleteUserLink(
    integrationId: string,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('integrationConnections')
      .where('integrationId', '=', integrationId)
      .where('userId', '=', userId)
      .where('kind', '=', 'user')
      .execute();
  }

  async upsertUserLink(
    input: {
      integrationId: string;
      workspaceId: string;
      userId: string;
      providerUserId: string;
      metadata: Record<string, unknown>;
    },
    trx?: KyselyTransaction,
  ): Promise<IntegrationConnection> {
    const db = dbOrTx(this.db, trx);
    // The unique index is partial on kind='user', so ON CONFLICT must repeat the predicate.
    return await db
      .insertInto('integrationConnections')
      .values({
        integrationId: input.integrationId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        providerUserId: input.providerUserId,
        kind: 'user',
        metadata: input.metadata as any,
        accessToken: null,
      })
      .onConflict((oc) =>
        oc
          .columns(['integrationId', 'userId'])
          .where(sql.ref('kind'), '=', 'user')
          .doUpdateSet({
            providerUserId: input.providerUserId,
            metadata: input.metadata as any,
            updatedAt: new Date(),
          }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
