import { Kysely, sql } from 'kysely';
import { SpaceRole, SpaceVisibility } from '../../helpers/types/permission';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('spaces')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name', 'varchar', (col) => col)
    .addColumn('description', 'text', (col) => col)
    .addColumn('slug', 'varchar', (col) => col)
    .addColumn('icon', 'varchar', (col) => col)
    .addColumn('visibility', 'varchar', (col) =>
      col.defaultTo(SpaceVisibility.OPEN).notNull(),
    )
    .addColumn('defaultRole', 'varchar', (col) =>
      col.defaultTo(SpaceRole.WRITER).notNull(),
    )
    .addColumn('creatorId', 'uuid', (col) => col)
    .addColumn('workspaceId', 'uuid', (col) => col.notNull())
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('UQ_spaces_slug_workspaceId', ['slug', 'workspaceId'])
    .execute();

  // foreign key relations
  await db.schema
    .alterTable('spaces')
    .addForeignKeyConstraint(
      'FK_spaces_users_creatorId',
      ['creatorId'],
      'users',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('spaces')
    .addForeignKeyConstraint(
      'FK_spaces_workspaces_workspaceId',
      ['workspaceId'],
      'workspaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .dropConstraint('FK_spaces_users_creatorId')
    .execute();

  await db.schema
    .alterTable('spaces')
    .dropConstraint('FK_spaces_workspaces_workspaceId')
    .execute();

  await db.schema.dropTable('spaces').execute();
}
