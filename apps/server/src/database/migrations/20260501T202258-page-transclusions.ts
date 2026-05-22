import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_transclusions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('transclusion_id', 'varchar', (col) => col.notNull())
    .addColumn('content', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('page_transclusions_page_transclusion_unique', [
      'page_id',
      'transclusion_id',
    ])
    .execute();

  await db.schema
    .createIndex('idx_page_transclusions_workspace')
    .on('page_transclusions')
    .column('workspace_id')
    .execute();

  await db.schema
    .createTable('page_transclusion_references')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('reference_page_id', 'uuid', (col) =>
      col.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('source_page_id', 'uuid', (col) =>
      col.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('transclusion_id', 'varchar', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('page_transclusion_references_unique', [
      'reference_page_id',
      'source_page_id',
      'transclusion_id',
    ])
    .execute();

  await db.schema
    .createIndex('idx_page_transclusion_references_source')
    .on('page_transclusion_references')
    .columns(['source_page_id', 'transclusion_id'])
    .execute();

  await db.schema
    .createIndex('idx_page_transclusion_references_workspace')
    .on('page_transclusion_references')
    .column('workspace_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_transclusion_references').execute();
  await db.schema.dropTable('page_transclusions').execute();
}
