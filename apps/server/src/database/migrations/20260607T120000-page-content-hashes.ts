import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_content_hashes')
    .addColumn('page_id', 'uuid', (col) =>
      col.primaryKey().references('pages.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('sha256', 'char(64)', (col) => col.notNull())
    .addColumn('char_len', 'integer', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('page_content_hashes_workspace_id_sha256_idx')
    .on('page_content_hashes')
    .columns(['workspace_id', 'sha256'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_content_hashes').execute();
}
