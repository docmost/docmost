import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .addForeignKeyConstraint(
      'workspaces_creatorId_fkey',
      ['creatorId'],
      'users',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('workspaces')
    .addForeignKeyConstraint(
      'workspaces_defaultSpaceId_fkey',
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
    .dropConstraint('workspaces_creatorId_fkey')
    .execute();

  await db.schema
    .alterTable('workspaces')
    .dropConstraint('workspaces_defaultSpaceId_fkey')
    .execute();
}
