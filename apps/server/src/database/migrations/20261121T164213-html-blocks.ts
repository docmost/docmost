import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('html_blocks')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .addColumn('template_id', 'uuid', (col) =>
      col.references('templates.id').onDelete('cascade'),
    )
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      'html_blocks_owner_check',
      sql`(page_id is null) <> (template_id is null)`,
    )
    .execute();

  await db.schema
    .createIndex('idx_html_blocks_page_id')
    .on('html_blocks')
    .column('page_id')
    .where(sql.ref('page_id'), 'is not', null)
    .execute();

  await db.schema
    .createIndex('idx_html_blocks_template_id')
    .on('html_blocks')
    .column('template_id')
    .where(sql.ref('template_id'), 'is not', null)
    .execute();

  await db.schema
    .createIndex('idx_html_blocks_workspace_id')
    .on('html_blocks')
    .column('workspace_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('html_blocks').execute();
}
