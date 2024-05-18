import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .addForeignKeyConstraint(
      'workspaces_default_space_id_fkey',
      ['default_space_id'],
      'spaces',
      ['id'],
    )
    .onDelete('set null')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .dropConstraint('workspaces_default_space_id_fkey')
    .execute();
}
