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
    .addColumn('parentPageId', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .addColumn('creatorId', 'uuid', (col) => col.references('users.id'))
    .addColumn('lastUpdatedById', 'uuid', (col) => col.references('users.id'))
    .addColumn('deletedById', 'uuid', (col) => col.references('users.id'))
    .addColumn('spaceId', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspaceId', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('isLocked', 'boolean', (col) => col.defaultTo(false).notNull())
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
    .createIndex('pages_tsv_idx')
    .on('pages')
    .using('GIN')
    .column('tsv')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_creatorId_fkey')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_lastUpdatedById_fkey')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_deletedById_fkey')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_spaceId_fkey')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_workspaceId_fkey')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('pages_parentPageId_fkey')
    .execute();

  await db.schema.dropTable('pages').execute();
}
