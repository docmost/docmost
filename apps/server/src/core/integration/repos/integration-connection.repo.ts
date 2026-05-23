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
          scopes: input.scopes ?? null,
          userId: input.userId,
        },
        trx,
      );
    }

    // No need to clear other rows: the migration 20260524T020000 made the
    // (integration_id, user_id) constraint partial-on-kind='user', so a
    // workspace insert never conflicts with the installer's user-link row.

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
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    // Never delete a kind='workspace' row from a per-user disconnect.
    // For Slack (and any future workspace-scoped provider) the installer's
    // userId matches the workspace connection's userId; without this filter
    // a single user clicking Disconnect would wipe the shared bot token and
    // break the integration for the whole workspace. Full uninstall uses
    // deleteByIntegration which intentionally has no kind filter.
    await db
      .deleteFrom('integrationConnections')
      .where('integrationId', '=', integrationId)
      .where('userId', '=', userId)
      .where('kind', '!=', 'workspace')
      .execute();
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
        'integrations.isEnabled',
        'integrationConnections.providerUserId',
        'integrationConnections.createdAt',
      ])
      .where('integrationConnections.userId', '=', userId)
      .where('integrations.workspaceId', '=', workspaceId)
      .where('integrations.deletedAt', 'is', null)
      .execute();
  }

  async findExpiringTokens(
    expiresBeforeMs: number,
  ): Promise<IntegrationConnection[]> {
    const threshold = new Date(Date.now() + expiresBeforeMs);
    return this.db
      .selectFrom('integrationConnections')
      .selectAll()
      .where('refreshToken', 'is not', null)
      .where('tokenExpiresAt', 'is not', null)
      .where('tokenExpiresAt', '<', threshold)
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
    // Target the partial unique index uq_integration_connections_user_per_integration
    // (integration_id, user_id) WHERE kind = 'user'. Without the .where() hint,
    // ON CONFLICT can't match a partial index. The kind discriminator means a
    // workspace bot row sharing (integration_id, user_id) with this user-link
    // is no longer a conflict, so we cannot flip its kind.
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
