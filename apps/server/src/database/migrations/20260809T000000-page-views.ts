import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_views')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('share_id', 'uuid')
    .addColumn('visitor_id', 'varchar', (col) => col.notNull())
    .addColumn('view_date', 'varchar', (col) => col.notNull())
    .addColumn('hits', 'int8', (col) => col.notNull().defaultTo(1))
    .addColumn('last_viewed_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_page_views_workspace_page_date')
    .ifNotExists()
    .on('page_views')
    .columns(['workspace_id', 'page_id', 'view_date'])
    .execute();

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS
      uq_page_views_workspace_page_identity
    ON page_views (
      workspace_id,
      page_id,
      COALESCE(user_id::text, visitor_id)
    )
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_views').ifExists().execute();
}
