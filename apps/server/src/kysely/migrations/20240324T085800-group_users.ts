import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('group_users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('userId', 'uuid', (col) => col.notNull())
    .addColumn('groupId', 'uuid', (col) => col.notNull())
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('UQ_group_users_groupId_userId', ['groupId', 'userId'])
    .execute();

  // foreign key relations
  await db.schema
    .alterTable('group_users')
    .addForeignKeyConstraint(
      'FK_group_users_users_userId',
      ['userId'],
      'users',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('group_users')
    .addForeignKeyConstraint(
      'FK_group_users_groups_groupId',
      ['groupId'],
      'groups',
      ['id'],
    )
    .onDelete('cascade')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('group_users')
    .dropConstraint('FK_group_users_users_userId')
    .execute();

  await db.schema
    .alterTable('group_users')
    .dropConstraint('FK_group_users_groups_groupId')
    .execute();

  await db.schema.dropTable('group_users').execute();
}
