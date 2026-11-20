import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .addColumn('template_id', 'uuid', (col) => col)
    .execute();

  await db.schema
    .createIndex('idx_attachments_template_id')
    .ifNotExists()
    .on('attachments')
    .column('template_id')
    .where(sql.ref('template_id'), 'is not', null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_attachments_template_id').execute();
  await db.schema.alterTable('attachments').dropColumn('template_id').execute();
}
