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
    .createIndex('idx_page_verifications_verified_history_id')
    .ifNotExists()
    .on('page_verifications')
    .column('verified_history_id')
    .where('verified_history_id', 'is not', null)
    .execute();

  await db.schema
    .createIndex('idx_page_verifications_rejected_history_id')
    .ifNotExists()
    .on('page_verifications')
    .column('rejected_history_id')
    .where('rejected_history_id', 'is not', null)
    .execute();

  // Expiry notice dedupe and the delete cascade from page_verifications
  await db.schema
    .createIndex('idx_notifications_page_verification_id')
    .ifNotExists()
    .on('notifications')
    .column('page_verification_id')
    .where('page_verification_id', 'is not', null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('idx_notifications_page_verification_id')
    .ifExists()
    .execute();

  await db.schema
    .dropIndex('idx_page_verifications_rejected_history_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_page_verifications_verified_history_id')
    .ifExists()
    .execute();

  await db.schema
    .alterTable('page_verifications')
    .dropColumn('rejected_history_id')
    .dropColumn('verified_history_id')
    .dropColumn('invalidated_by_id')
    .dropColumn('invalidated_at')
    .execute();
}
