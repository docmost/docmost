import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspace_invitations')
    .addColumn('token', 'varchar', (col) => col)
    .addColumn('group_ids', sql`uuid[]`, (col) => col)
    .execute();

  await db.schema
    .alterTable('workspace_invitations')
    .dropColumn('status')
    .execute();

  await db.schema
    .alterTable('workspace_invitations')
    .addUniqueConstraint('invitation_email_workspace_id_unique', [
      'email',
      'workspace_id',
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspace_invitations')
    .dropColumn('token')
    .execute();
  await db.schema
    .alterTable('workspace_invitations')
    .dropColumn('group_ids')
    .execute();

  await db.schema
    .alterTable('workspace_invitations')
    .addColumn('status', 'varchar', (col) => col)
    .execute();

  await db.schema
    .alterTable('workspace_invitations')
    .dropConstraint('invitation_email_workspace_id_unique')
    .execute();
}
