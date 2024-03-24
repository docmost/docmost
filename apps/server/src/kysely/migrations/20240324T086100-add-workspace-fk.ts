import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .addForeignKeyConstraint(
      'FK_workspaces_users_creatorId',
      ['creatorId'],
      'users',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('workspaces')
    .addForeignKeyConstraint(
      'FK_workspaces_spaces_defaultSpaceId',
      ['defaultSpaceId'],
      'spaces',
      ['id'],
    )
    .onDelete('set null')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .dropConstraint('FK_workspaces_users_creatorId')
    .execute();

  await db.schema
    .alterTable('workspaces')
    .dropConstraint('FK_workspaces_spaces_defaultSpaceId')
    .execute();
}
