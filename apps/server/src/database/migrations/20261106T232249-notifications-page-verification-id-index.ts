import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
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
}
