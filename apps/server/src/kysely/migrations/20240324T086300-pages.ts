import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('pages')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('title', 'varchar', (col) => col)
    .addColumn('icon', 'varchar', (col) => col)
    .addColumn('key', 'varchar', (col) => col)
    .addColumn('content', 'jsonb', (col) => col)
    .addColumn('html', 'text', (col) => col)
    .addColumn('text_content', 'text', (col) => col)
    .addColumn('tsv', sql`tsvector`, (col) => col)
    .addColumn('ydoc', 'bytea', (col) => col)
    .addColumn('slug', 'varchar', (col) => col)
    .addColumn('cover_photo', 'varchar', (col) => col)
    .addColumn('editor', 'varchar', (col) => col)
    .addColumn('parent_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('last_updated_by_id', 'uuid', (col) =>
      col.references('users.id'),
    )
    .addColumn('deleted_by_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('is_locked', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('status', 'varchar', (col) => col)
    .addColumn('published_at', 'date', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .createIndex('pages_tsv_idx')
    .on('pages')
    .using('GIN')
    .column('tsv')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_creator_id_fkey')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_last_updated_by_id_fkey')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_deleted_by_id_fkey')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_space_id_fkey')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_workspace_id_fkey')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_parent_page_id_fkey')
    .execute();

  await db.schema.dropTable('pages').execute();
}
