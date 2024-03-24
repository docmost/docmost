import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .addForeignKeyConstraint(
      'FK_pages_users_creatorId',
      ['creatorId'],
      'users',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('pages')
    .addForeignKeyConstraint(
      'FK_pages_users_lastUpdatedById',
      ['lastUpdatedById'],
      'users',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('pages')
    .addForeignKeyConstraint(
      'FK_pages_users_deletedById',
      ['deletedById'],
      'users',
      ['id'],
    )
    .execute();

  await db.schema
    .alterTable('pages')
    .addForeignKeyConstraint('FK_pages_spaces_spaceId', ['spaceId'], 'spaces', [
      'id',
    ])
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('pages')
    .addForeignKeyConstraint(
      'FK_pages_workspaces_workspaceId',
      ['workspaceId'],
      'workspaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('pages')
    .addForeignKeyConstraint(
      'FK_pages_pages_parentPageId',
      ['parentPageId'],
      'pages',
      ['id'],
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .dropConstraint('FK_pages_users_creatorId')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('FK_pages_users_lastUpdatedById')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('FK_pages_users_deletedById')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('FK_pages_spaces_spaceId')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('FK_pages_workspaces_workspaceId')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropConstraint('FK_pages_pages_parentPageId')
    .execute();
}
