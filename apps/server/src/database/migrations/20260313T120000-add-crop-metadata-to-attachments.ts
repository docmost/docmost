import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .addColumn('crop_metadata', 'jsonb', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .dropColumn('crop_metadata')
    .execute();
}
