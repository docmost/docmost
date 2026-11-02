import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .addColumn('archived_at', 'timestamptz')
    .addColumn('archived_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .dropColumn('archived_at')
    .dropColumn('archived_by_id')
    .execute();
}
