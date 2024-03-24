import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('attachments')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('fileName', 'varchar', (col) => col.notNull())
    .addColumn('filePath', 'varchar', (col) => col.notNull())
    .addColumn('fileSize', 'int8', (col) => col)
    .addColumn('fileExt', 'varchar', (col) => col.notNull())
    .addColumn('mimeType', 'varchar', (col) => col)
    .addColumn('type', 'varchar', (col) => col)
    .addColumn('creatorId', 'uuid', (col) => col.notNull())
    .addColumn('pageId', 'uuid', (col) => col)
    .addColumn('spaceId', 'uuid', (col) => col)
    .addColumn('workspaceId', 'uuid', (col) => col.notNull())
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deletedAt', 'timestamp', (col) => col)
    .execute();

  // foreign key relations
  await db.schema
    .alterTable('attachments')
    .addForeignKeyConstraint(
      'FK_attachments_users_creatorId',
      ['creatorId'],
      'users',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('attachments')
    .addForeignKeyConstraint(
      'FK_attachments_pages_pageId',
      ['pageId'],
      'pages',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('attachments')
    .addForeignKeyConstraint(
      'FK_attachments_spaces_spaceId',
      ['spaceId'],
      'spaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('attachments')
    .addForeignKeyConstraint(
      'FK_attachments_workspaces_workspaceId',
      ['workspaceId'],
      'workspaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .dropConstraint('FK_attachments_users_creatorId')
    .execute();

  await db.schema
    .alterTable('attachments')
    .dropConstraint('FK_attachments_pages_pageId')
    .execute();

  await db.schema
    .alterTable('attachments')
    .dropConstraint('FK_attachments_spaces_spaceId')
    .execute();

  await db.schema
    .alterTable('attachments')
    .dropConstraint('FK_attachments_workspaces_workspaceId')
    .execute();

  await db.schema.dropTable('attachments').execute();
}
