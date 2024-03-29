import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_history')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('pageId', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('title', 'varchar', (col) => col)
    .addColumn('content', 'jsonb', (col) => col)
    .addColumn('slug', 'varchar', (col) => col)
    .addColumn('icon', 'varchar', (col) => col)
    .addColumn('coverPhoto', 'varchar', (col) => col)
    .addColumn('version', 'int4', (col) => col.notNull())
    .addColumn('lastUpdatedById', 'uuid', (col) => col.references('users.id'))
    .addColumn('spaceId', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspaceId', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_history')
    .dropConstraint('page_history_pageId_fkey')
    .execute();

  await db.schema
    .alterTable('page_history')
    .dropConstraint('page_history_lastUpdatedById_fkey')
    .execute();

  await db.schema
    .alterTable('page_history')
    .dropConstraint('page_history_spaceId_fkey')
    .execute();

  await db.schema
    .alterTable('page_history')
    .dropConstraint('page_history_workspaceId_fkey')
    .execute();

  await db.schema.dropTable('page_history').execute();
}
