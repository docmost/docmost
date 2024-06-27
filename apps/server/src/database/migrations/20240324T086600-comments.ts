import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('comments')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('content', 'jsonb', (col) => col)
    .addColumn('selection', 'varchar', (col) => col)
    .addColumn('type', 'varchar', (col) => col)
    .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('parent_comment_id', 'uuid', (col) =>
      col.references('comments.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').notNull(),
    )
    .addColumn('resolved_at', 'timestamptz', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('edited_at', 'timestamptz', (col) => col)
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('comments').execute();
}
