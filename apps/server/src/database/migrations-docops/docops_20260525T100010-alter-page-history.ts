import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_history')
    .addColumn('change_request_id', 'uuid', (col) =>
      col.references('change_requests.id'),
    )
    .execute();

  await db.schema
    .alterTable('page_history')
    .addColumn('is_published_version', 'boolean', (col) =>
      col.defaultTo(false),
    )
    .execute();

  await db.schema
    .alterTable('page_history')
    .addColumn('published_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .alterTable('page_history')
    .addColumn('published_by_id', 'uuid', (col) => col.references('users.id'))
    .execute();

  await db.schema
    .createIndex('idx_page_history_cr')
    .ifNotExists()
    .on('page_history')
    .column('change_request_id')
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_page_history_published
    ON page_history (page_id, published_at DESC)
    WHERE is_published_version = true
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_history')
    .dropColumn('published_by_id')
    .execute();

  await db.schema
    .alterTable('page_history')
    .dropColumn('published_at')
    .execute();

  await db.schema
    .alterTable('page_history')
    .dropColumn('is_published_version')
    .execute();

  await db.schema
    .alterTable('page_history')
    .dropColumn('change_request_id')
    .execute();
}
