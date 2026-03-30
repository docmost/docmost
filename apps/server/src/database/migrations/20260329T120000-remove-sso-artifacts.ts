import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('workspaces').dropColumn('enforce_sso').execute();
  await db.schema.dropTable('auth_accounts').execute();
  await db.schema.dropTable('auth_providers').execute();
  await db.schema.dropType('auth_provider_type').ifExists().execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('auth_providers')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('saml_url', 'varchar', (col) => col)
    .addColumn('saml_certificate', 'varchar', (col) => col)
    .addColumn('oidc_issuer', 'varchar', (col) => col)
    .addColumn('oidc_client_id', 'varchar', (col) => col)
    .addColumn('oidc_client_secret', 'varchar', (col) => col)
    .addColumn('allow_signup', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn('is_enabled', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('group_sync', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn('ldap_url', 'varchar', (col) => col)
    .addColumn('ldap_bind_dn', 'varchar', (col) => col)
    .addColumn('ldap_bind_password', 'varchar', (col) => col)
    .addColumn('ldap_base_dn', 'varchar', (col) => col)
    .addColumn('ldap_user_search_filter', 'varchar', (col) => col)
    .addColumn('ldap_user_attributes', 'jsonb', (col) => col)
    .addColumn('ldap_tls_enabled', 'boolean', (col) => col)
    .addColumn('ldap_tls_ca_cert', 'text', (col) => col)
    .addColumn('ldap_config', 'jsonb', (col) => col)
    .addColumn('settings', 'jsonb', (col) => col)
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .createTable('auth_accounts')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('provider_user_id', 'varchar', (col) => col.notNull())
    .addColumn('auth_provider_id', 'uuid', (col) =>
      col.references('auth_providers.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint('auth_accounts_user_id_auth_provider_id_unique', [
      'user_id',
      'auth_provider_id',
    ])
    .execute();

  await db.schema
    .alterTable('workspaces')
    .addColumn('enforce_sso', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .execute();
}
