import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('webhooks')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('signing_secret', 'text', (col) => col.notNull())
    .addColumn('subscribed_events', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .addColumn('is_active', 'boolean', (col) =>
      col.notNull().defaultTo(true),
    )
    .addColumn('consecutive_failure_count', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn('disabled_at', 'timestamptz')
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
    .createIndex('idx_webhooks_workspace_id')
    .ifNotExists()
    .on('webhooks')
    .columns(['workspace_id', 'id desc'])
    .execute();

  await db.schema
    .createIndex('idx_webhooks_subscribed_events')
    .ifNotExists()
    .on('webhooks')
    .using('gin')
    .column('subscribed_events')
    .execute();

  await db.schema
    .createTable('webhook_deliveries')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('webhook_id', 'uuid', (col) =>
      col.notNull().references('webhooks.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('event', 'varchar', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('status', 'varchar', (col) =>
      col.notNull().defaultTo('pending'),
    )
    .addColumn('http_status', 'integer')
    .addColumn('response_body', 'text')
    .addColumn('error_message', 'text')
    .addColumn('attempt_count', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn('duration_ms', 'integer')
    .addColumn('delivered_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_webhook_deliveries_webhook_id')
    .ifNotExists()
    .on('webhook_deliveries')
    .columns(['webhook_id', 'id desc'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('webhook_deliveries').execute();
  await db.schema.dropTable('webhooks').execute();
}
