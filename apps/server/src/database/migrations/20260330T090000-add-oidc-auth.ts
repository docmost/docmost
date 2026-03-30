import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('auth_providers')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('slug', 'varchar', (col) => col.notNull())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull().defaultTo('oidc'))
    .addColumn('oidc_issuer', 'varchar', (col) => col.notNull())
    .addColumn('oidc_client_id', 'varchar', (col) => col.notNull())
    .addColumn('oidc_client_secret', 'varchar', (col) => col.notNull())
    .addColumn('oidc_redirect_uri', 'varchar', (col) => col.notNull())
    .addColumn('scopes', sql`varchar[]`, (col) =>
      col.notNull().defaultTo(sql`ARRAY['openid', 'email', 'profile']::varchar[]`),
    )
    .addColumn('domains', sql`varchar[]`, (col) => col)
    .addColumn('auto_join_by_email', 'boolean', (col) =>
      col.notNull().defaultTo(true),
    )
    .addColumn('auto_create_users', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('is_enabled', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('last_used_at', 'timestamptz', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint('auth_providers_workspace_id_slug_unique', [
      'workspace_id',
      'slug',
    ])
    .addUniqueConstraint(
      'auth_providers_workspace_id_oidc_issuer_oidc_client_id_unique',
      ['workspace_id', 'oidc_issuer', 'oidc_client_id'],
    )
    .execute();

  await db.schema
    .createTable('auth_accounts')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('auth_provider_id', 'uuid', (col) =>
      col.references('auth_providers.id').onDelete('cascade').notNull(),
    )
    .addColumn('provider_user_id', 'varchar', (col) => col.notNull())
    .addColumn('provider_email', 'varchar', (col) => col)
    .addColumn('metadata', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint(
      'auth_accounts_workspace_id_auth_provider_id_provider_user_id_unique',
      ['workspace_id', 'auth_provider_id', 'provider_user_id'],
    )
    .addUniqueConstraint('auth_accounts_user_id_auth_provider_id_unique', [
      'user_id',
      'auth_provider_id',
    ])
    .execute();

  await db.schema
    .alterTable('workspaces')
    .addColumn('enforce_sso', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('workspaces').dropColumn('enforce_sso').execute();
  await db.schema.dropTable('auth_accounts').execute();
  await db.schema.dropTable('auth_providers').execute();
}
