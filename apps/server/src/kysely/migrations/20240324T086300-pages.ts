import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('pages')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('title', 'varchar', (col) => col)
    .addColumn('icon', 'varchar', (col) => col)
    .addColumn('content', 'jsonb', (col) => col)
    .addColumn('html', 'text', (col) => col)
    .addColumn('textContent', 'text', (col) => col)
    .addColumn('tsv', sql`tsvector`, (col) => col)
    .addColumn('ydoc', 'bytea', (col) => col)
    .addColumn('slug', 'varchar', (col) => col)
    .addColumn('coverPhoto', 'varchar', (col) => col)
    .addColumn('editor', 'varchar', (col) => col)
    .addColumn('shareId', 'varchar', (col) => col)
    .addColumn('parentPageId', 'uuid', (col) => col)
    .addColumn('creatorId', 'uuid', (col) => col.notNull())
    .addColumn('lastUpdatedById', 'uuid', (col) => col)
    .addColumn('deletedById', 'uuid', (col) => col)
    .addColumn('spaceId', 'uuid', (col) => col.notNull())
    .addColumn('workspaceId', 'uuid', (col) => col.notNull())
    .addColumn('isLocked', 'boolean', (col) => col.notNull())
    .addColumn('status', 'varchar', (col) => col)
    .addColumn('publishedAt', 'date', (col) => col)
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deletedAt', 'timestamp', (col) => col)
    .execute();

  await db.schema
    .createIndex('IDX_pages_tsv')
    .on('pages')
    .using('GIN')
    .column('tsv')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('IDX_pages_tsv').on('pages').execute();
  await db.schema.dropTable('pages').execute();
}
