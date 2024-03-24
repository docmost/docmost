import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('space_members')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('userId', 'uuid', (col) => col)
    .addColumn('groupId', 'uuid', (col) => col)
    .addColumn('spaceId', 'uuid', (col) => col.notNull())
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('creatorId', 'uuid', (col) => col)
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('UQ_space_members_spaceId_userId', [
      'spaceId',
      'userId',
    ])
    .addUniqueConstraint('UQ_space_members_spaceId_groupId', [
      'spaceId',
      'groupId',
    ])
    .addCheckConstraint(
      'CHK_allow_userId_or_groupId',
      sql`(("userId" IS NOT NULL AND "groupId" IS NULL) OR ("userId" IS NULL AND "groupId" IS NOT NULL))`,
    )
    .execute();

  // foreign key relations
  await db.schema
    .alterTable('space_members')
    .addForeignKeyConstraint(
      'FK_space_members_users_userId',
      ['userId'],
      'users',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('space_members')
    .addForeignKeyConstraint(
      'FK_space_members_groups_groupId',
      ['groupId'],
      'groups',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('space_members')
    .addForeignKeyConstraint(
      'FK_space_members_spaces_spaceId',
      ['spaceId'],
      'spaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('space_members')
    .addForeignKeyConstraint(
      'FK_space_members_users_creatorId',
      ['creatorId'],
      'users',
      ['id'],
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('space_members')
    .dropConstraint('FK_space_members_users_userId')
    .execute();

  await db.schema
    .alterTable('space_members')
    .dropConstraint('FK_space_members_groups_groupId')
    .execute();

  await db.schema
    .alterTable('space_members')
    .dropConstraint('FK_space_members_spaces_spaceId')
    .execute();

  await db.schema
    .alterTable('space_members')
    .dropConstraint('FK_space_members_users_creatorId')
    .execute();
  await db.schema.dropTable('space_members').execute();
}
