import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('oauth_clients')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('redirect_uris', 'jsonb', (col) => col.notNull())
    .addColumn('client_uri', 'text')
    .addColumn('logo_uri', 'text')
    .addColumn('grant_types', 'jsonb', (col) => col.notNull())
    .addColumn('scopes', 'jsonb', (col) => col.notNull())
    .addColumn('token_endpoint_auth_method', 'text', (col) => col.notNull().defaultTo('none'))
    .addColumn('secret_hash', 'text')
    .addColumn('is_dynamic', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute();
  await db.schema.createIndex('oauth_clients_workspace_id_idx').on('oauth_clients').column('workspace_id').execute();

  await db.schema
    .createTable('oauth_authorization_codes')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('code_hash', 'text', (col) => col.notNull().unique())
    .addColumn('client_id', 'uuid', (col) => col.notNull().references('oauth_clients.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
    .addColumn('scopes', 'jsonb', (col) => col.notNull())
    .addColumn('redirect_uri', 'text', (col) => col.notNull())
    .addColumn('code_challenge', 'text')
    .addColumn('code_challenge_method', 'text')
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('consumed_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('oauth_authorization_codes_expires_at_idx').on('oauth_authorization_codes').column('expires_at').execute();
  await db.schema.createIndex('oauth_authorization_codes_consumed_at_idx').on('oauth_authorization_codes').column('consumed_at').execute();
  await db.schema.createIndex('oauth_authorization_codes_client_id_idx').on('oauth_authorization_codes').column('client_id').execute();
  await db.schema.createIndex('oauth_authorization_codes_user_id_idx').on('oauth_authorization_codes').column('user_id').execute();
  await db.schema.createIndex('oauth_authorization_codes_workspace_id_idx').on('oauth_authorization_codes').column('workspace_id').execute();

  await db.schema
    .createTable('oauth_grants')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('client_id', 'uuid', (col) => col.notNull().references('oauth_clients.id').onDelete('cascade'))
    .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
    .addColumn('scopes', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('last_used_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .addUniqueConstraint('oauth_grants_user_client_unique', ['user_id', 'client_id'])
    .execute();

  // The user_id/client_id unique constraint cannot serve client-side FK lookups.
  await db.schema.createIndex('oauth_grants_client_id_idx').on('oauth_grants').column('client_id').execute();

  await db.schema
    .createTable('oauth_tokens')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('grant_id', 'uuid', (col) => col.notNull().references('oauth_grants.id').onDelete('cascade'))
    .addColumn('workspace_id', 'uuid', (col) => col.notNull().references('workspaces.id').onDelete('cascade'))
    .addColumn('access_token_jti', 'text', (col) => col.notNull())
    .addColumn('refresh_token_hash', 'text', (col) => col.unique())
    .addColumn('scopes', 'jsonb', (col) => col.notNull())
    .addColumn('access_expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('refresh_expires_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('oauth_tokens_grant_id_idx').on('oauth_tokens').column('grant_id').execute();
  await db.schema.createIndex('oauth_tokens_access_token_jti_idx').on('oauth_tokens').columns(['workspace_id', 'access_token_jti']).execute();
  // One index per branch of the cleanup sweep's OR so it can bitmap-or them.
  await db.schema.createIndex('oauth_tokens_access_expires_at_idx').on('oauth_tokens').column('access_expires_at').execute();
  await db.schema.createIndex('oauth_tokens_refresh_expires_at_idx').on('oauth_tokens').column('refresh_expires_at').execute();
  await db.schema.createIndex('oauth_tokens_revoked_at_idx').on('oauth_tokens').column('revoked_at').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('oauth_tokens').execute();
  await db.schema.dropTable('oauth_grants').execute();
  await db.schema.dropTable('oauth_authorization_codes').execute();
  await db.schema.dropTable('oauth_clients').execute();
}
