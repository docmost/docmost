import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('webhook_delivery_logs')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('webhook_id', 'uuid', (col) =>
      col.notNull().references('webhooks_config.id').onDelete('cascade'),
    )
    .addColumn('event', 'text', (col) => col.notNull())
    .addColumn('delivery_id', 'uuid', (col) => col.notNull())
    .addColumn('attempt_number', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('status_code', 'integer')
    .addColumn('error_message', 'text')
    .addColumn('duration_ms', 'integer')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createIndex('idx_webhook_delivery_logs_webhook')
    .on('webhook_delivery_logs')
    .columns(['webhook_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('webhook_delivery_logs').execute();
}
