import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('siem_destinations')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('config', 'jsonb', (col) => col.notNull())
    .addColumn('secrets', 'text', (col) => col.notNull())
    .addColumn('cursor_created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('cursor_id', 'uuid', (col) =>
      col.notNull().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('cursor_snapshot', 'text')
    // Fences cursor writes from stale jobs after configuration changes.
    .addColumn('version', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('healthy'))
    .addColumn('consecutive_failures', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn('next_attempt_at', 'timestamptz')
    .addColumn('last_delivered_at', 'timestamptz')
    .addColumn('last_error', 'text')
    .addColumn('last_error_at', 'timestamptz')
    .addColumn('failing_since', 'timestamptz')
    .addColumn('creator_id', 'uuid', (col) =>
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
    .createIndex('idx_siem_destinations_workspace_id')
    .ifNotExists()
    .on('siem_destinations')
    .columns(['workspace_id'])
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_siem_destinations_due
    ON siem_destinations (next_attempt_at)
    WHERE enabled = true
  `.execute(db);

  await db.schema.alterTable('audit').addColumn('user_agent', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('audit').dropColumn('user_agent').execute();
  await db.schema.dropTable('siem_destinations').ifExists().execute();
}
