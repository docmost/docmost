import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Multiple page_verification rows per page are now valid (one per QMS
  // review cycle after an approved page's content changes) — the original
  // 1:1 uniqueness assumption from the initial page-verification feature
  // no longer holds for type='qms'. Verify the constraint name below
  // against the live DB first (see Interfaces note above).
  await db.schema
    .alterTable('page_verifications')
    .dropConstraint('page_verifications_page_id_key')
    .execute();

  await db.schema
    .createIndex('idx_page_verifications_page_id')
    .ifNotExists()
    .on('page_verifications')
    .column('page_id')
    .execute();

  await db.schema
    .alterTable('page_verifications')
    .addColumn('page_history_id', 'uuid', (col) =>
      col.references('page_history.id').onDelete('set null'),
    )
    .addColumn('submitted_at', 'timestamptz')
    .addColumn('clarification_requested_at', 'timestamptz')
    .addColumn('clarification_requested_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .execute();

  await db.schema
    .createTable('page_verification_reviews')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_verification_id', 'uuid', (col) =>
      col.notNull().references('page_verifications.id').onDelete('cascade'),
    )
    .addColumn('verifier_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('decision', 'varchar', (col) =>
      col.notNull().defaultTo('pending'),
    )
    .addColumn('decided_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_page_verification_reviews_verification_id')
    .ifNotExists()
    .on('page_verification_reviews')
    .column('page_verification_id')
    .execute();

  await db.schema
    .createIndex('idx_page_verification_reviews_verifier_id')
    .ifNotExists()
    .on('page_verification_reviews')
    .column('verifier_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_verification_reviews').ifExists().execute();
  await db.schema
    .alterTable('page_verifications')
    .dropColumn('page_history_id')
    .dropColumn('submitted_at')
    .dropColumn('clarification_requested_at')
    .dropColumn('clarification_requested_by_id')
    .execute();

  await db.schema
    .dropIndex('idx_page_verifications_page_id')
    .ifExists()
    .execute();

  // NOTE: this will fail if any page now has >1 page_verification row
  // (i.e. this migration has been live long enough for a real review
  // cycle to have run) — down() is a best-effort dev-rollback path here,
  // not a guaranteed production revert.
  await db.schema
    .alterTable('page_verifications')
    .addUniqueConstraint('page_verifications_page_id_key', ['page_id'])
    .execute();
}
