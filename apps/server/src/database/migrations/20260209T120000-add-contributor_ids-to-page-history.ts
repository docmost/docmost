import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_history')
    .addColumn('contributor_ids', sql`uuid[]`, (col) => col.defaultTo('{}'))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_history')
    .dropColumn('contributor_ids')
    .execute();
}
