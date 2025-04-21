import { Kysely, sql } from 'kysely';
import {
  SpaceRole,
  SpaceVisibility,
} from '../../common/helpers/types/permission';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('spaces')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('name', 'varchar', (col) => col)
    .addColumn('description', 'text', (col) => col)
    .addColumn('slug', 'varchar', (col) => col.notNull())
    .addColumn('logo', 'varchar', (col) => col)
    .addColumn('visibility', 'varchar', (col) =>
      col.defaultTo(SpaceVisibility.PRIVATE).notNull(),
    )
    .addColumn('default_role', 'varchar', (col) =>
      col.defaultTo(SpaceRole.WRITER).notNull(),
    )
    .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint('spaces_slug_workspace_id_unique', [
      'slug',
      'workspace_id',
    ])
    .execute();

  await db.schema
    .createTable('space_members')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade'),
    )
    .addColumn('group_id', 'uuid', (col) =>
      col.references('groups.id').onDelete('cascade'),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('added_by_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .addUniqueConstraint('space_members_space_id_user_id_unique', [
      'space_id',
      'user_id',
    ])
    .addUniqueConstraint('space_members_space_id_group_id_unique', [
      'space_id',
      'group_id',
    ])
    .addCheckConstraint(
      'allow_either_user_id_or_group_id_check',
      sql`(("user_id" IS NOT NULL AND "group_id" IS NULL) OR ("user_id" IS NULL AND "group_id" IS NOT NULL))`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('space_members').execute();
  await db.schema.dropTable('spaces').execute();
}
