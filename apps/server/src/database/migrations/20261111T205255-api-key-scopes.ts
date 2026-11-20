import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('api_keys')
    .addColumn('scopes', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'["read", "write"]'::jsonb`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('api_keys').dropColumn('scopes').execute();
}
