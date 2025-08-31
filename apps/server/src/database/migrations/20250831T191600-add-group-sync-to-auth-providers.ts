import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('auth_providers')
    .addColumn('is_group_sync_enabled', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('auth_providers')
    .dropColumn('is_group_sync_enabled')
    .execute();
}