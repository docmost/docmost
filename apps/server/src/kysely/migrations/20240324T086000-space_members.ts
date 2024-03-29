import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('space_members')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('userId', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade'),
    )
    .addColumn('groupId', 'uuid', (col) =>
      col.references('groups.id').onDelete('cascade'),
    )
    .addColumn('spaceId', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('creatorId', 'uuid', (col) => col.references('users.id'))
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('space_members_spaceId_userId_unique', [
      'spaceId',
      'userId',
    ])
    .addUniqueConstraint('space_members_spaceId_groupId_unique', [
      'spaceId',
      'groupId',
    ])
    .addCheckConstraint(
      'allow_either_userId_or_groupId_check',
      sql`(("userId" IS NOT NULL AND "groupId" IS NULL) OR ("userId" IS NULL AND "groupId" IS NOT NULL))`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('space_members')
    .dropConstraint('space_members_userId_fkey')
    .execute();

  await db.schema
    .alterTable('space_members')
    .dropConstraint('space_members_groupId_fkey')
    .execute();

  await db.schema
    .alterTable('space_members')
    .dropConstraint('space_members_spaceId_fkey')
    .execute();

  await db.schema
    .alterTable('space_members')
    .dropConstraint('space_members_creatorId_fkey')
    .execute();
  await db.schema.dropTable('space_members').execute();
}
