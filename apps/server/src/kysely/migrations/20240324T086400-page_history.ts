import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_history')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('pageId', 'uuid', (col) => col.notNull())
    .addColumn('title', 'varchar', (col) => col)
    .addColumn('content', 'jsonb', (col) => col)
    .addColumn('slug', 'varchar', (col) => col)
    .addColumn('icon', 'varchar', (col) => col)
    .addColumn('coverPhoto', 'varchar', (col) => col)
    .addColumn('version', 'int4', (col) => col.notNull())
    .addColumn('lastUpdatedById', 'uuid', (col) => col.notNull())
    .addColumn('spaceId', 'uuid', (col) => col.notNull())
    .addColumn('workspaceId', 'uuid', (col) => col.notNull())
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // foreign key relations
  await db.schema
    .alterTable('page_history')
    .addForeignKeyConstraint(
      'FK_page_history_pages_pageId',
      ['pageId'],
      'pages',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('page_history')
    .addForeignKeyConstraint(
      'FK_page_history_users_lastUpdatedById',
      ['lastUpdatedById'],
      'users',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('page_history')
    .addForeignKeyConstraint(
      'FK_page_history_spaces_spaceId',
      ['spaceId'],
      'spaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('page_history')
    .addForeignKeyConstraint(
      'FK_page_history_workspaces_workspaceId',
      ['workspaceId'],
      'workspaces',
      ['id'],
    )
    .onDelete('cascade')
    .onUpdate('no action')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_history')
    .dropConstraint('FK_page_history_pages_pageId')
    .execute();

  await db.schema
    .alterTable('page_history')
    .dropConstraint('FK_page_history_users_lastUpdatedById')
    .execute();

  await db.schema
    .alterTable('page_history')
    .dropConstraint('FK_page_history_spaces_spaceId')
    .execute();

  await db.schema
    .alterTable('page_history')
    .dropConstraint('FK_page_history_workspaces_workspaceId')
    .execute();

  await db.schema.dropTable('page_history').execute();
}
