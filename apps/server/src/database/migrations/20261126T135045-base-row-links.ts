import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('base_row_links')
    .addColumn('relation_id', 'uuid', (col) => col.notNull())
    .addColumn('source_row_id', 'uuid', (col) =>
      col.notNull().references('base_rows.id').onDelete('cascade'),
    )
    .addColumn('target_row_id', 'uuid', (col) =>
      col.notNull().references('base_rows.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint('base_row_links_pkey', [
      'source_row_id',
      'relation_id',
      'target_row_id',
    ])
    .execute();

  await db.schema
    .createIndex('idx_base_row_links_source')
    .on('base_row_links')
    .columns(['source_row_id', 'relation_id', 'created_at'])
    .execute();

  await sql`
    CREATE INDEX idx_base_row_links_target
    ON base_row_links (target_row_id, relation_id, created_at) INCLUDE (source_row_id)
  `.execute(db);

  await sql`
    CREATE INDEX idx_base_properties_relation_id
    ON base_properties ((type_options->>'relationId'))
    WHERE type = 'relation'
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_base_properties_relation_id').execute();
  await db.schema.dropTable('base_row_links').execute();
}
