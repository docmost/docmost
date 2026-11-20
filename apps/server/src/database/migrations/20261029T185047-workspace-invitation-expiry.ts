import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspace_invitations')
    .addColumn('expires_at', 'timestamptz')
    .execute();

  await db
    .updateTable('workspace_invitations')
    .set({ expires_at: sql`created_at + interval '7 days'` })
    .execute();

  await db.schema
    .alterTable('workspace_invitations')
    .alterColumn('expires_at', (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workspace_invitations')
    .dropColumn('expires_at')
    .execute();
}
