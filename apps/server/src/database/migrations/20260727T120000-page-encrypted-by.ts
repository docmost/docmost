import { type Kysely, sql } from 'kysely';

/**
 * Who set a section's password, which is not the same as who created the page:
 * anyone with edit rights can encrypt a page someone else wrote. Changing or
 * removing encryption is gated on this rather than on the page's creator, who
 * may never have known the password. Null for sections encrypted before this
 * existed — those fall back to the creator.
 *
 * A separate migration rather than an amendment to the one that created the
 * other encryption columns: that one has already run on databases tracking this
 * branch, and Kysely will not re-apply a migration it has recorded. IF NOT
 * EXISTS so an environment that was hand-patched before this landed converges
 * instead of failing.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE pages ADD COLUMN IF NOT EXISTS encrypted_by_id uuid
    REFERENCES users(id) ON DELETE SET NULL
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE pages DROP COLUMN IF EXISTS encrypted_by_id`.execute(
    db,
  );
}
