import { type Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .addColumn('is_published', 'boolean', (col) => col.defaultTo(false).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('spaces').dropColumn('is_published').execute();
}
  