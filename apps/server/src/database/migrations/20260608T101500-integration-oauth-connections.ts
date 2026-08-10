import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('integration_oauth_connections')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('integration_id', 'varchar', (col) => col.notNull())
    .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('base_url', 'text', (col) => col.notNull())
    .addColumn('oauth_client_id', 'text', (col) => col.notNull())
    .addColumn('oauth_client_secret_encrypted', 'text')
    // Provider-defined connection settings declared by the manifest
    // (IntegrationManifest.connectionSettings), validated at save time.
    .addColumn('settings', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('created_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('updated_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_integration_oauth_connections_workspace_integration')
    .ifNotExists()
    .on('integration_oauth_connections')
    .columns(['workspace_id', 'integration_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_integration_oauth_connections_workspace')
    .ifNotExists()
    .on('integration_oauth_connections')
    .column('workspace_id')
    .execute();

  await db.schema
    .alterTable('integration_oauth_tokens')
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade'),
    )
    .execute();

  await db.executeQuery(
    sql`
    update integration_oauth_tokens t
    set workspace_id = u.workspace_id
    from users u
    where t.user_id = u.id and t.workspace_id is null
  `.compile(db),
  );

  await db.executeQuery(
    sql`
    delete from integration_oauth_tokens where workspace_id is null
  `.compile(db),
  );

  await db.executeQuery(
    sql`
    alter table integration_oauth_tokens
    alter column workspace_id set not null
  `.compile(db),
  );

  await db.schema
    .dropIndex('idx_integration_oauth_tokens_user_integration')
    .ifExists()
    .execute();

  await db.schema
    .createIndex('idx_integration_oauth_tokens_user_workspace_integration')
    .ifNotExists()
    .on('integration_oauth_tokens')
    .columns(['user_id', 'workspace_id', 'integration_id'])
    .unique()
    .execute();

  await db.schema
    .createIndex('idx_integration_oauth_tokens_workspace')
    .ifNotExists()
    .on('integration_oauth_tokens')
    .column('workspace_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('idx_integration_oauth_tokens_workspace')
    .ifExists()
    .execute();

  await db.schema
    .dropIndex('idx_integration_oauth_tokens_user_workspace_integration')
    .ifExists()
    .execute();

  // Collapsing back to a per-user unique key: when a user connected the same
  // integration in several workspaces, keep only the most recent token so the
  // unique index below can be recreated.
  await db.executeQuery(
    sql`
    delete from integration_oauth_tokens t
    using integration_oauth_tokens newer
    where t.user_id = newer.user_id
      and t.integration_id = newer.integration_id
      and t.created_at < newer.created_at
  `.compile(db),
  );

  await db.schema
    .createIndex('idx_integration_oauth_tokens_user_integration')
    .ifNotExists()
    .on('integration_oauth_tokens')
    .columns(['user_id', 'integration_id'])
    .unique()
    .execute();

  await db.schema
    .alterTable('integration_oauth_tokens')
    .dropColumn('workspace_id')
    .execute();

  await db.schema.dropTable('integration_oauth_connections').execute();
}
