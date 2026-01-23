import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .addColumn('landing_page_id', 'uuid', (col) => col)
    .execute();

  await db.schema
    .alterTable('workspaces')
    .addForeignKeyConstraint(
      'workspaces_landing_page_id_fkey',
      ['landing_page_id'],
      'pages',
      ['id'],
    )
    .onDelete('set null')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .dropConstraint('workspaces_landing_page_id_fkey')
    .execute();

  await db.schema
    .alterTable('workspaces')
    .dropColumn('landing_page_id')
    .execute();
}

