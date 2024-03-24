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
    .addColumn('workspaceId', 'uuid', (col) => col.notNull())
    .addColumn('creatorId', 'uuid', (col) => col)
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('UQ_groups_name_workspaceId', ['name', 'workspaceId'])

    .execute();

  // foreign key relations
  await db.schema
    .alterTable('groups')
    .addForeignKeyConstraint(
      'FK_groups_workspaces_workspaceId',
      ['workspaceId'],
      'workspaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('groups')
    .addForeignKeyConstraint(
      'FK_groups_users_creatorId',
      ['creatorId'],
      'users',
      ['id'],
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('groups')
    .dropConstraint('FK_groups_workspaces_workspaceId')
    .execute();

  await db.schema
    .alterTable('groups')
    .dropConstraint('FK_groups_users_creatorId')
    .execute();

  await db.schema.dropTable('groups').execute();
}
