import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .addColumn('enable_ai', 'boolean', (col) => col.defaultTo(false))
    .addColumn('enable_ai_search', 'boolean', (col) => col.defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('workspaces').dropColumn('enable_ai').execute();
  await db.schema.alterTable('workspaces').dropColumn('enable_ai_search').execute();
}
