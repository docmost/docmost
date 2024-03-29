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
    .addColumn('creatorId', 'uuid', (col) => col.references('users.id'))
    .addColumn('workspaceId', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('spaces_slug_workspaceId_unique', [
      'slug',
      'workspaceId',
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .dropConstraint('spaces_creatorId_fkey')
    .execute();

  await db.schema
    .alterTable('spaces')
    .dropConstraint('spaces_workspaceId_fkey')
    .execute();

  await db.schema.dropTable('spaces').execute();
}
