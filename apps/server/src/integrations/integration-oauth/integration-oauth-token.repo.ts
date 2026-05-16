import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  IntegrationOauthToken,
  InsertableIntegrationOauthToken,
} from '@docmost/db/types/entity.types';

/**
 * Token vault keyed `(user_id, integration_id)` — one row per user per
 * integration. Deals only in already-encrypted blobs; never sees plaintext.
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

  /** Used both on initial connect and after refresh-token rotation. */
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
