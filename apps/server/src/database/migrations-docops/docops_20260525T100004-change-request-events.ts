import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('change_request_events')
    .ifNotExists()
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('change_request_id', 'uuid', (col) =>
      col.notNull().references('change_requests.id'),
    )
    .addColumn('from_status', 'varchar', (col) => col)
    .addColumn('to_status', 'varchar', (col) => col.notNull())
    .addColumn('actor_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('reason', 'text', (col) => col)
    .addColumn('metadata', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_cr_events_cr')
    .ifNotExists()
    .on('change_request_events')
    .columns(['change_request_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('change_request_events').execute();
}
