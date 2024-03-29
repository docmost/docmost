import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('comments')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('content', 'jsonb', (col) => col)
    .addColumn('selection', 'varchar', (col) => col)
    .addColumn('type', 'varchar', (col) => col)
    .addColumn('creatorId', 'uuid', (col) => col.references('users.id'))
    .addColumn('pageId', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('parentCommentId', 'uuid', (col) =>
      col.references('comments.id').onDelete('cascade'),
    )
    .addColumn('workspaceId', 'uuid', (col) =>
      col.references('workspaces.id').notNull(),
    )
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('editedAt', 'timestamp', (col) => col)
    .addColumn('deletedAt', 'timestamp', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('comments')
    .dropConstraint('comments_creatorId_fkey')
    .execute();

  await db.schema
    .alterTable('comments')
    .dropConstraint('comments_pageId_fkey')
    .execute();

  await db.schema
    .alterTable('comments')
    .dropConstraint('comments_parentCommentId_fkey')
    .execute();

  await db.schema
    .alterTable('comments')
    .dropConstraint('comments_workspaceId_fkey')
    .execute();

  await db.schema.dropTable('comments').execute();
}
