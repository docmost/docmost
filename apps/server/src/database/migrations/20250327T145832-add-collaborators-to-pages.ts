import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .addColumn('collaborators', sql`uuid[]`, (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('pages').dropColumn('collaborators').execute();
}
