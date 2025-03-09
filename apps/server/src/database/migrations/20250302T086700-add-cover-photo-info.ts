import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .addColumn('orginal_path', 'varchar', (col) => col)
    .addColumn('description', 'varchar', (col) => col)
    .addColumn('description_url', 'varchar', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .dropColumn('orginal_path')
    .dropColumn('description')
    .dropColumn('description_url')
    .execute();
}
