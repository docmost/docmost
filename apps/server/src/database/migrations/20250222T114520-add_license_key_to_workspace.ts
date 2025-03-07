import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .addColumn('license_key', 'varchar', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('workspaces').dropColumn('license_key').execute();
}
