import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('page_verifications')
    .addColumn('invalidated_at', 'timestamptz')
    .addColumn('invalidated_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('verified_history_id', 'uuid', (col) =>
      col.references('page_history.id').onDelete('set null'),
    )
    .addColumn('rejected_history_id', 'uuid', (col) =>
      col.references('page_history.id').onDelete('set null'),
    )
    .execute();

  await db.schema
    .createIndex('page_verifications_verified_history_id_idx')
    .on('page_verifications')
    .column('verified_history_id')
    .where('verified_history_id', 'is not', null)
    .execute();

  await db.schema
    .createIndex('page_verifications_rejected_history_id_idx')
    .on('page_verifications')
    .column('rejected_history_id')
    .where('rejected_history_id', 'is not', null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('page_verifications_rejected_history_id_idx')
    .execute();
  await db.schema
    .dropIndex('page_verifications_verified_history_id_idx')
    .execute();

  await db.schema
    .alterTable('page_verifications')
    .dropColumn('rejected_history_id')
    .dropColumn('verified_history_id')
    .dropColumn('invalidated_by_id')
    .dropColumn('invalidated_at')
    .execute();
}
