import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .addColumn('text_content', 'text', (col) => col)
    .addColumn('tsv', sql`tsvector`, (col) => col)
    .execute();

  await db.schema
    .createIndex('attachments_tsv_idx')
    .on('attachments')
    .using('GIN')
    .column('tsv')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .dropIndex('attachments_tsv_idx')
    .execute();

  await db.schema
    .alterTable('attachments')
    .dropColumn('text_content')
    .dropColumn('tsv')
    .execute();
}
