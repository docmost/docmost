import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('workspace_invitations')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('workspaceId', 'uuid', (col) => col.notNull())
    .addColumn('invitedById', 'uuid', (col) => col.notNull())
    .addColumn('email', 'varchar', (col) => col.notNull())
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('status', 'varchar', (col) => col)
    .addColumn('createdAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // foreign key relations
  await db.schema
    .alterTable('workspace_invitations')
    .addForeignKeyConstraint(
      'FK_workspace_invitations_workspaces_workspaceId',
      ['workspaceId'],
      'workspaces',
      ['id'],
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('workspace_invitations')
    .addForeignKeyConstraint(
      'FK_workspace_invitations_users_invitedById',
      ['invitedById'],
      'users',
      ['id'],
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspace_invitations')
    .dropConstraint('FK_workspace_invitations_workspaces_workspaceId')
    .execute();

  await db.schema
    .alterTable('workspace_invitations')
    .dropConstraint('FK_workspace_invitations_users_invitedById')
    .execute();
  await db.schema.dropTable('workspace_invitations').execute();
}
