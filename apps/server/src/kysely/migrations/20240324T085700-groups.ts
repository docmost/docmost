import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('groups')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col)
    .addColumn('isDefault', 'boolean', (col) => col.notNull())
    .addColumn('workspaceId', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('creatorId', 'uuid', (col) => col.references('users.id'))
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('groups_name_workspaceId_unique', [
      'name',
      'workspaceId',
    ])

    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('groups')
    .dropConstraint('groups_workspaceId_fkey')
    .execute();

  await db.schema
    .alterTable('groups')
    .dropConstraint('groups_creatorId_fkey')
    .execute();

  await db.schema.dropTable('groups').execute();
}
