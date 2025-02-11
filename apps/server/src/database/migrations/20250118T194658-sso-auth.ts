import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createType('auth_provider_type')
    .asEnum(['saml', 'oidc', 'google'])
    .execute();

  await db.schema
    .createTable('auth_providers')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('type', sql`auth_provider_type`, (col) => col.notNull())

    // SAML
    .addColumn('saml_url', 'varchar', (col) => col)
    .addColumn('saml_certificate', 'varchar', (col) => col)

    // OIDC
    .addColumn('oidc_issuer', 'varchar', (col) => col)
    .addColumn('oidc_client_id', 'varchar', (col) => col)
    .addColumn('oidc_client_secret', 'varchar', (col) => col)

    .addColumn('allow_signup', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn('is_enabled', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .createTable('auth_accounts')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
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
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
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

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('auth_accounts').execute();
  await db.schema.dropTable('auth_providers').execute();
  await db.schema.alterTable('workspaces').dropColumn('enforce_sso').execute();
  await db.schema.dropType('auth_provider_type').execute();
}
