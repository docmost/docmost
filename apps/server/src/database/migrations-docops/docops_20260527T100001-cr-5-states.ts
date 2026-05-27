import { type Kysely, sql } from 'kysely';

// Kysely migrator already wraps each migration in a transaction — do not nest.
export async function up(db: Kysely<any>): Promise<void> {
  // Step 1: add close_reason column
  await sql`ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS close_reason VARCHAR NULL`.execute(db);

  // Step 2: migrate statuses in change_requests
  // ORDER MATTERS: rename old IN_VERIFICATION to a temp marker first,
  // to avoid collision when renaming APPROVED → IN_VERIFICATION.
  await sql`UPDATE change_requests SET status = '_IN_PROGRESS_TEMP' WHERE status = 'IN_VERIFICATION'`.execute(db);
  await sql`UPDATE change_requests SET status = 'IN_REVIEW' WHERE status IN ('DRAFT', 'REQUESTED')`.execute(db);
  await sql`UPDATE change_requests SET status = 'IN_VERIFICATION' WHERE status = 'APPROVED'`.execute(db);
  await sql`UPDATE change_requests SET status = 'IN_PROGRESS' WHERE status IN ('IN_IMPLEMENTATION', '_IN_PROGRESS_TEMP')`.execute(db);
  await sql`UPDATE change_requests SET status = 'CLOSED', close_reason = 'REJECTED' WHERE status = 'REJECTED'`.execute(db);
  await sql`UPDATE change_requests SET status = 'CLOSED', close_reason = 'CANCELLED' WHERE status = 'CANCELLED'`.execute(db);
  // CLOSED stays CLOSED (close_reason remains NULL), PUBLISHED stays PUBLISHED

  // Step 3: migrate from_status in change_request_events
  await sql`UPDATE change_request_events SET from_status = '_IN_PROGRESS_TEMP' WHERE from_status = 'IN_VERIFICATION'`.execute(db);
  await sql`UPDATE change_request_events SET from_status = 'IN_REVIEW' WHERE from_status IN ('DRAFT', 'REQUESTED')`.execute(db);
  await sql`UPDATE change_request_events SET from_status = 'IN_VERIFICATION' WHERE from_status = 'APPROVED'`.execute(db);
  await sql`UPDATE change_request_events SET from_status = 'IN_PROGRESS' WHERE from_status IN ('IN_IMPLEMENTATION', '_IN_PROGRESS_TEMP')`.execute(db);
  await sql`UPDATE change_request_events SET from_status = 'CLOSED' WHERE from_status IN ('REJECTED', 'CANCELLED')`.execute(db);

  // Step 4: migrate to_status in change_request_events
  await sql`UPDATE change_request_events SET to_status = '_IN_PROGRESS_TEMP' WHERE to_status = 'IN_VERIFICATION'`.execute(db);
  await sql`UPDATE change_request_events SET to_status = 'IN_REVIEW' WHERE to_status IN ('DRAFT', 'REQUESTED')`.execute(db);
  await sql`UPDATE change_request_events SET to_status = 'IN_VERIFICATION' WHERE to_status = 'APPROVED'`.execute(db);
  await sql`UPDATE change_request_events SET to_status = 'IN_PROGRESS' WHERE to_status IN ('IN_IMPLEMENTATION', '_IN_PROGRESS_TEMP')`.execute(db);
  await sql`UPDATE change_request_events SET to_status = 'CLOSED' WHERE to_status IN ('REJECTED', 'CANCELLED')`.execute(db);

  // Step 5: drop and recreate idx_cr_due_date with new active states
  await sql`DROP INDEX IF EXISTS idx_cr_due_date`.execute(db);
  await sql`CREATE INDEX idx_cr_due_date ON change_requests(due_date) WHERE status IN ('IN_REVIEW', 'IN_VERIFICATION', 'IN_PROGRESS')`.execute(db);

  // Step 6: drop old partial unique index, recreate with new active states
  await sql`DROP INDEX IF EXISTS idx_cr_active_per_service`.execute(db);
  await sql`CREATE UNIQUE INDEX idx_cr_active_per_service ON change_requests(service_id) WHERE status IN ('IN_REVIEW', 'IN_VERIFICATION', 'IN_PROGRESS')`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // WARNING: Data migration is intentionally NOT reversed.
  // Statuses DRAFT, REQUESTED, APPROVED, IN_IMPLEMENTATION, REJECTED, CANCELLED
  // no longer exist; rolling back the schema without restoring data from a backup
  // will leave the application in an unrecoverable state.
  // DO NOT run down() on production without a prior database snapshot.
  await sql`DROP INDEX IF EXISTS idx_cr_due_date`.execute(db);
  await sql`CREATE INDEX idx_cr_due_date ON change_requests(due_date) WHERE status IN ('APPROVED', 'IN_IMPLEMENTATION')`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_cr_active_per_service`.execute(db);
  await sql`CREATE UNIQUE INDEX idx_cr_active_per_service ON change_requests(service_id) WHERE status IN ('IN_REVIEW', 'APPROVED', 'IN_IMPLEMENTATION', 'IN_VERIFICATION')`.execute(db);
  await sql`ALTER TABLE change_requests DROP COLUMN IF EXISTS close_reason`.execute(db);
}
