import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_ordering')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('entityId', 'uuid', (col) => col.notNull())
    .addColumn('entityType', 'varchar', (col) => col.notNull())
    .addColumn('childrenIds', sql`uuid[]`, (col) => col.notNull())
    .addColumn('spaceId', 'uuid', (col) => col.notNull())
    .addColumn('workspaceId', 'uuid', (col) => col.notNull())
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deletedAt', 'timestamp', (col) => col)
    .addUniqueConstraint('UQ_page_ordering_entityId_entityType', [
      'entityId',
      'entityType',
    ])
    .execute();

  // foreign key relations
  await db.schema
    .alterTable('page_ordering')
    .addForeignKeyConstraint(
      'FK_page_ordering_spaces_spaceId',
      ['spaceId'],
      'spaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('page_ordering')
    .addForeignKeyConstraint(
      'FK_page_ordering_workspaces_workspaceId',
      ['workspaceId'],
      'workspaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_ordering')
    .dropConstraint('FK_page_ordering_spaces_spaceId')
    .execute();

  await db.schema
    .alterTable('page_ordering')
    .dropConstraint('FK_page_ordering_workspaces_workspaceId')
    .execute();

  await db.schema.dropTable('page_ordering').execute();
}
