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
    .addColumn('is_enabled', 'boolean', (col) => col.notNull().defaultTo(true))
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
    // Nullable: workspace-scoped rows carry a token; user-scoped identity-link
    // rows have no token (the binding alone is what they store).
    .addColumn('access_token', 'text')
    .addColumn('refresh_token', 'text')
    .addColumn('token_expires_at', 'timestamptz')
    .addColumn('scopes', 'text')
    .addColumn('metadata', 'jsonb')
    // 'workspace' = one shared bot/app connection per integration (Slack);
    // 'user' = a per-user OAuth token or identity link (Linear, GitHub, Slack
    // identity binding). Enforced via a check constraint below.
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

  // One user-link row per (integration, user). Partial on kind='user' so a
  // workspace bot row sharing (integration_id, user_id) with the installer's
  // personal user-link is NOT a conflict — they are semantically different
  // rows with their own constraints.
  await db.schema
    .createIndex('uq_integration_connections_user_per_integration')
    .on('integration_connections')
    .columns(['integration_id', 'user_id'])
    .where(sql.ref('kind'), '=', 'user')
    .unique()
    .execute();

  await db.schema
    .createTable('integration_webhooks')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('integration_id', 'uuid', (col) =>
      col.references('integrations.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('event_type', 'text', (col) => col.notNull())
    .addColumn('webhook_url', 'text')
    .addColumn('secret', 'text')
    .addColumn('is_enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_integration_webhooks_integration_event')
    .ifNotExists()
    .on('integration_webhooks')
    .columns(['integration_id', 'event_type'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('integration_webhooks').execute();
  await db.schema.dropTable('integration_connections').execute();
  await db.schema.dropTable('integrations').execute();
}
