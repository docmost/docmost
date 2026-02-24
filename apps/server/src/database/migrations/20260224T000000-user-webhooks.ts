import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user_webhooks')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('format', 'varchar(20)', (col) =>
      col.notNull().defaultTo('discord'),
    )
    .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('events', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'["mention", "comment", "page_update"]'::jsonb`),
    )
    .addColumn('last_triggered_at', 'timestamptz')
    .addColumn('failure_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('uq_user_webhooks_user_workspace', [
      'user_id',
      'workspace_id',
    ])
    .execute();

  await db.schema
    .createIndex('idx_user_webhooks_user_id')
    .on('user_webhooks')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('user_webhooks').execute();
}
