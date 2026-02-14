import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('watchers')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('type', 'varchar(20)', (col) => col.notNull())
    .addColumn('added_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('muted_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Unique index for page watchers (user can only watch a page once)
  await sql`CREATE UNIQUE INDEX idx_watchers_user_page ON watchers (user_id, page_id) WHERE page_id IS NOT NULL`.execute(
    db,
  );

  // Unique index for space watchers (user can only watch a space once)
  await sql`CREATE UNIQUE INDEX idx_watchers_user_space ON watchers (user_id, space_id) WHERE page_id IS NULL`.execute(
    db,
  );

  // Query index for fetching watchers by page
  await db.schema
    .createIndex('idx_watchers_page_id')
    .on('watchers')
    .column('page_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('watchers').execute();
}
