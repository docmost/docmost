import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('integrations')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('settings', 'jsonb')
    .addColumn('installed_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz')
    .addUniqueConstraint('uq_integrations_workspace_type', [
      'workspace_id',
      'type',
    ])
    .execute();

  await db.schema
    .createTable('integration_connections')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('integration_id', 'uuid', (col) =>
      col.references('integrations.id').onDelete('cascade').notNull(),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('provider_user_id', 'text')
    .addColumn('access_token', 'text')
    .addColumn('refresh_token', 'text')
    .addColumn('token_expires_at', 'timestamptz')
    .addColumn('invalidated_at', 'timestamptz')
    .addColumn('scopes', 'text')
    .addColumn('metadata', 'jsonb')
    // 'workspace': one shared bot connection per integration. 'user': a personal token or identity link.
    .addColumn('kind', 'text', (col) => col.notNull().defaultTo('user'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`
    ALTER TABLE integration_connections
    ADD CONSTRAINT integration_connections_kind_check
    CHECK (kind IN ('workspace', 'user'))
  `.execute(db);

  // One workspace-bot connection per integration.
  await db.schema
    .createIndex('uq_integration_connections_workspace_per_integration')
    .on('integration_connections')
    .column('integration_id')
    .where(sql.ref('kind'), '=', 'workspace')
    .unique()
    .execute();

  await db.schema
    .createIndex('uq_integration_connections_user_per_integration')
    .on('integration_connections')
    .columns(['integration_id', 'user_id'])
    .where(sql.ref('kind'), '=', 'user')
    .unique()
    .execute();

  // One Docmost user per provider account; token-only rows have a null provider_user_id.
  await db.schema
    .createIndex('uq_integration_connections_provider_user_per_integration')
    .on('integration_connections')
    .columns(['integration_id', 'provider_user_id'])
    .where(sql.ref('kind'), '=', 'user')
    .where(sql.ref('provider_user_id'), 'is not', null)
    .unique()
    .execute();

  // Offboarding deletes by user_id, and so does the users FK cascade; the indexes above lead with integration_id.
  await db.schema
    .createIndex('idx_integration_connections_user_id')
    .on('integration_connections')
    .column('user_id')
    .execute();

  // The refresh job reads the soonest-expiring refreshable tokens in order.
  await db.schema
    .createIndex('idx_integration_connections_token_expires_at')
    .on('integration_connections')
    .column('token_expires_at')
    .where(sql.ref('refresh_token'), 'is not', null)
    .where(sql.ref('invalidated_at'), 'is', null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('integration_connections').ifExists().execute();
  await db.schema.dropTable('integrations').ifExists().execute();
}
