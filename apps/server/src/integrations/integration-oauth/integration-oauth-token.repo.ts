import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  IntegrationOauthToken,
  InsertableIntegrationOauthToken,
} from '@docmost/db/types/entity.types';

/**
 * Read/write access for the per-user OAuth token vault.
 *
 * Keyed `(user_id, integration_id)` — single-instance v1: one token row per
 * user per integration. Tokens are stored encrypted at rest; this repo deals
 * exclusively in already-encrypted blobs and never sees plaintext.
 */
@Injectable()
export class IntegrationOAuthTokenRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByUserAndIntegration(
    userId: string,
    integrationId: string,
  ): Promise<IntegrationOauthToken | undefined> {
    return this.db
      .selectFrom('integrationOauthTokens')
      .selectAll()
      .where('userId', '=', userId)
      .where('integrationId', '=', integrationId)
      .executeTakeFirst();
  }

  async listByUser(userId: string): Promise<IntegrationOauthToken[]> {
    return this.db
      .selectFrom('integrationOauthTokens')
      .selectAll()
      .where('userId', '=', userId)
      .orderBy('integrationId', 'asc')
      .execute();
  }

  /**
   * Upsert by `(user_id, integration_id)` — used both on initial connect and
   * after a refresh-token rotation. `updatedAt` is bumped server-side and
   * `needsReconnect` is reset, since a successful upsert means we got a
   * working token.
   */
  async upsert(row: InsertableIntegrationOauthToken): Promise<IntegrationOauthToken> {
    return this.db
      .insertInto('integrationOauthTokens')
      .values(row)
      .onConflict((oc) =>
        oc.columns(['userId', 'integrationId']).doUpdateSet({
          accessTokenEncrypted: row.accessTokenEncrypted,
          refreshTokenEncrypted: row.refreshTokenEncrypted ?? null,
          expiresAt: row.expiresAt ?? null,
          scopes: row.scopes ?? '',
          needsReconnect: false,
          updatedAt: sql`now()`,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async markNeedsReconnect(userId: string, integrationId: string): Promise<void> {
    await this.db
      .updateTable('integrationOauthTokens')
      .set({ needsReconnect: true, updatedAt: sql`now()` })
      .where('userId', '=', userId)
      .where('integrationId', '=', integrationId)
      .execute();
  }

  async delete(userId: string, integrationId: string): Promise<void> {
    await this.db
      .deleteFrom('integrationOauthTokens')
      .where('userId', '=', userId)
      .where('integrationId', '=', integrationId)
      .execute();
  }
}
