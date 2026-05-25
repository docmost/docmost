import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // cr_draft_id: FK added after change_requests table exists
  await db.schema
    .alterTable('pages')
    .addColumn('cr_draft_id', 'uuid', (col) =>
      col.references('change_requests.id'),
    )
    .execute();

  await db.schema
    .alterTable('pages')
    .addColumn('current_published_version_id', 'uuid', (col) =>
      col.references('page_history.id'),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .dropColumn('current_published_version_id')
    .execute();

  await db.schema.alterTable('pages').dropColumn('cr_draft_id').execute();
}
