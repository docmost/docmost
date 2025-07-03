import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('comments')
    .addColumn('resolved_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade'),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('comments').dropColumn('resolved_by_id').execute();
}
