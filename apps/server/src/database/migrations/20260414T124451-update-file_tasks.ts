import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('file_tasks')
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null').ifNotExists(),
    )
    .execute();

  await db.schema
    .alterTable('file_tasks')
    .addColumn('metadata', 'jsonb', (col) => col.ifNotExists())
    .execute();

  await db.schema
    .createIndex('idx_file_tasks_page_export')
    .ifNotExists()
    .on('file_tasks')
    .columns(['page_id', 'workspace_id'])
    .where(sql.ref('type'), '=', 'export')
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_file_tasks_page_export').execute();

  await db.schema.alterTable('file_tasks').dropColumn('page_id').execute();

  await db.schema.alterTable('file_tasks').dropColumn('metadata').execute();
}
