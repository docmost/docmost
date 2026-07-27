import { type Kysely, sql } from 'kysely';

/**
 * The encrypted-section invariants, enforced by the database rather than only
 * by the conversion service: a keyed page must be encrypted and must NOT carry
 * its own key, and an encrypted page must have a key reachable one way or the
 * other. This closes paths the service never sees — page restore, imports, and
 * any future direct insert.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE pages ADD CONSTRAINT pages_keyed_page_has_no_own_key
    CHECK (
      encryption_root_id IS NULL
      OR (is_encrypted AND encryption_meta IS NULL)
    )
  `.execute(db);

  await sql`
    ALTER TABLE pages ADD CONSTRAINT pages_encrypted_page_has_a_key
    CHECK (
      NOT is_encrypted
      OR encryption_root_id IS NOT NULL
      OR encryption_meta IS NOT NULL
    )
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE pages DROP CONSTRAINT pages_encrypted_page_has_a_key`.execute(
    db,
  );
  await sql`ALTER TABLE pages DROP CONSTRAINT pages_keyed_page_has_no_own_key`.execute(
    db,
  );
}
