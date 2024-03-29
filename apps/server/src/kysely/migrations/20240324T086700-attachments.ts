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
    .addColumn('creatorId', 'uuid', (col) =>
      col.references('users.id').notNull(),
    )
    .addColumn('pageId', 'uuid', (col) => col.references('pages.id'))
    .addColumn('spaceId', 'uuid', (col) => col.references('spaces.id'))
    .addColumn('workspaceId', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deletedAt', 'timestamp', (col) => col)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .dropConstraint('attachments_creatorId_fkey')
    .execute();

  await db.schema
    .alterTable('attachments')
    .dropConstraint('attachments_pageId_fkey')
    .execute();

  await db.schema
    .alterTable('attachments')
    .dropConstraint('attachments_spaceId_fkey')
    .execute();

  await db.schema
    .alterTable('attachments')
    .dropConstraint('attachments_workspaceId_fkey')
    .execute();

  await db.schema.dropTable('attachments').execute();
}
