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
    .addColumn('creatorId', 'uuid', (col) => col.notNull())
    .addColumn('pageId', 'uuid', (col) => col.notNull())
    .addColumn('parentCommentId', 'uuid', (col) => col)
    .addColumn('resolvedById', 'uuid', (col) => col)
    .addColumn('resolvedAt', 'timestamp', (col) => col)
    .addColumn('spaceId', 'uuid', (col) => col.notNull())
    .addColumn('workspaceId', 'uuid', (col) => col.notNull())
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('editedAt', 'timestamp', (col) => col)
    .addColumn('deletedAt', 'timestamp', (col) => col)
    .execute();

  // foreign key relations
  await db.schema
    .alterTable('comments')
    .addForeignKeyConstraint(
      'FK_comments_users_creatorId',
      ['creatorId'],
      'users',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('comments')
    .addForeignKeyConstraint('FK_comments_pages_pageId', ['pageId'], 'pages', [
      'id',
    ])
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('comments')
    .addForeignKeyConstraint(
      'FK_comments_comments_parentCommentId',
      ['parentCommentId'],
      'comments',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('comments')
    .addForeignKeyConstraint(
      'FK_comments_users_resolvedById',
      ['resolvedById'],
      'users',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('comments')
    .addForeignKeyConstraint(
      'FK_comments_spaces_spaceId',
      ['spaceId'],
      'spaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('comments')
    .addForeignKeyConstraint(
      'FK_comments_workspaces_workspaceId',
      ['workspaceId'],
      'workspaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('comments')
    .dropConstraint('FK_comments_users_creatorId')
    .execute();

  await db.schema
    .alterTable('comments')
    .dropConstraint('FK_comments_pages_pageId')
    .execute();

  await db.schema
    .alterTable('comments')
    .dropConstraint('FK_comments_comments_parentCommentId')
    .execute();

  await db.schema
    .alterTable('comments')
    .dropConstraint('FK_comments_users_resolvedById')
    .execute();

  await db.schema
    .alterTable('comments')
    .dropConstraint('FK_comments_spaces_spaceId')
    .execute();

  await db.schema
    .alterTable('comments')
    .dropConstraint('FK_comments_workspaces_workspaceId')
    .execute();

  await db.schema.dropTable('comments').execute();
}
