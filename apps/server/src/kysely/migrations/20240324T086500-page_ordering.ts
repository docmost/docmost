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
    .addColumn('spaceId', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
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
    .addUniqueConstraint('page_ordering_entityId_entityType_unique', [
      'entityId',
      'entityType',
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_ordering')
    .dropConstraint('page_ordering_spaceId_fkey')
    .execute();

  await db.schema
    .alterTable('page_ordering')
    .dropConstraint('page_ordering_workspaceId_fkey')
    .execute();

  await db.schema.dropTable('page_ordering').execute();
}
