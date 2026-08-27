import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Adding a NOT NULL column with a default is metadata-only on PG 11+, so
  // there is no rewrite — but the brief ACCESS EXCLUSIVE lock can still queue
  // behind a long reader. Fail fast rather than blocking writes.
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db);

  // Track how a group membership came to exist. Existing rows default to
  // 'manual' so nothing already in the database can ever be auto-removed
  // by a sync.
  await db.schema
    .alterTable('group_users')
    .addColumn('source', 'varchar', (col) =>
      col.notNull().defaultTo('manual'),
    )
    .execute();

  await db.schema
    .alterTable('group_users')
    .addColumn('synced_at', 'timestamptz')
    .execute();

  await sql`
    ALTER TABLE group_users
    ADD CONSTRAINT group_users_source_check
    CHECK (source IN ('manual', 'google'))
  `.execute(db);

  // Stops two concurrent first-visits to the settings page from creating two
  // Google provider rows, which would make lookups nondeterministic.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_providers_workspace_type
    ON auth_providers (workspace_id, type)
    WHERE type = 'google' AND deleted_at IS NULL
  `.execute(db);

  await db.schema
    .createTable('auth_provider_group_mappings')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('auth_provider_id', 'uuid', (col) =>
      col.references('auth_providers.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('external_group_key', 'varchar', (col) => col.notNull())
    .addColumn('group_id', 'uuid', (col) =>
      col.references('groups.id').onDelete('cascade').notNull(),
    )
    .addColumn('role', 'varchar')
    .addColumn('last_synced_at', 'timestamptz')
    .addColumn('last_sync_status', 'varchar')
    .addColumn('last_sync_error', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint(
      'auth_provider_group_mappings_provider_external_group_unique',
      ['auth_provider_id', 'external_group_key', 'group_id'],
    )
    .execute();

  await db.schema
    .createIndex('idx_auth_provider_group_mappings_workspace_id')
    .ifNotExists()
    .on('auth_provider_group_mappings')
    .column('workspace_id')
    .execute();

  await db.schema
    .createIndex('idx_auth_provider_group_mappings_group_id')
    .ifNotExists()
    .on('auth_provider_group_mappings')
    .column('group_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('auth_provider_group_mappings').execute();
  await sql`DROP INDEX IF EXISTS idx_auth_providers_workspace_type`.execute(db);
  await sql`
    ALTER TABLE group_users DROP CONSTRAINT IF EXISTS group_users_source_check
  `.execute(db);
  await db.schema.alterTable('group_users').dropColumn('synced_at').execute();
  await db.schema.alterTable('group_users').dropColumn('source').execute();
}
