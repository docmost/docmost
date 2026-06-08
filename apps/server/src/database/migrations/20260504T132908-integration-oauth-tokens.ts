import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('integration_oauth_tokens')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    // Stable identifier for the third-party integration (e.g. 'github',
    // 'linear'). Matches IntegrationManifest.id.
    .addColumn('integration_id', 'varchar', (col) => col.notNull())
    .addColumn('access_token_encrypted', 'text', (col) => col.notNull())
    .addColumn('refresh_token_encrypted', 'text')
    .addColumn('expires_at', 'timestamptz')
    // Space-separated list of granted OAuth scopes — what the provider
    // actually granted at exchange time, not what was requested.
    .addColumn('scopes', 'text', (col) => col.notNull().defaultTo(''))
    // Set when refresh has hard-failed (refresh token revoked / expired);
    // surfaces a "Reconnect" prompt in the settings UI.
    .addColumn('needs_reconnect', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // One token row per user per integration — single-instance v1.
  await db.schema
    .createIndex('idx_integration_oauth_tokens_user_integration')
    .ifNotExists()
    .on('integration_oauth_tokens')
    .columns(['user_id', 'integration_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_integration_oauth_tokens_integration')
    .ifNotExists()
    .on('integration_oauth_tokens')
    .column('integration_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('integration_oauth_tokens').execute();
}
