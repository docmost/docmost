import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('external_refs')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('change_request_id', 'uuid', (col) =>
      col.notNull().references('change_requests.id').onDelete('cascade'),
    )
    .addColumn('ref_type', 'varchar', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('label', 'varchar', (col) => col)
    .addColumn('fetched_metadata', 'jsonb', (col) => col)
    .addColumn('created_by_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_external_refs_cr')
    .ifNotExists()
    .on('external_refs')
    .column('change_request_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('external_refs').execute();
}
