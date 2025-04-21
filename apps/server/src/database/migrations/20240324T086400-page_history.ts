import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_history')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('slug_id', 'varchar', (col) => col)
    .addColumn('title', 'varchar', (col) => col)
    .addColumn('content', 'jsonb', (col) => col)
    .addColumn('slug', 'varchar', (col) => col)
    .addColumn('icon', 'varchar', (col) => col)
    .addColumn('cover_photo', 'varchar', (col) => col)
    .addColumn('version', 'int4', (col) => col)
    .addColumn('last_updated_by_id', 'uuid', (col) =>
      col.references('users.id'),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_history').execute();
}
