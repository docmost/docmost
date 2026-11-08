import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .addColumn('cover_position', 'real')
    .addColumn('cover_attribution', 'jsonb')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .dropColumn('cover_position')
    .dropColumn('cover_attribution')
    .execute();
}
