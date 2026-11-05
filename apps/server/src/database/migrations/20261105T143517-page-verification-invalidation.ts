import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_verifications')
    .addColumn('invalidated_at', 'timestamptz')
    .addColumn('invalidated_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_verifications')
    .dropColumn('invalidated_by_id')
    .dropColumn('invalidated_at')
    .execute();
}
