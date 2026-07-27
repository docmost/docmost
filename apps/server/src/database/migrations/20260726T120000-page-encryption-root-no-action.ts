import { type Kysely, sql } from 'kysely';

/**
 * ON DELETE SET NULL was wrong for encryption_root_id: hard-deleting a root
 * would null out the pointer on any page still keyed to it, leaving an
 * encrypted page with no reachable DEK — silently unreadable ciphertext (and
 * a violation of pages_encrypted_page_has_a_key).
 *
 * NO ACTION instead: the check is deferred to the end of the statement, so
 * the normal case still works — pages.parent_page_id is ON DELETE CASCADE, so
 * purging a root deletes the pages keyed to it in the same statement and no
 * referencing row remains. Only a page that somehow outlived its section
 * blocks the delete, loudly, instead of being quietly stranded.
 *
 * RESTRICT would NOT work here: it is checked immediately and would fire on
 * the very rows the cascade is deleting.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE pages DROP CONSTRAINT pages_encryption_root_id_fkey`.execute(
    db,
  );
  await sql`
    ALTER TABLE pages ADD CONSTRAINT pages_encryption_root_id_fkey
    FOREIGN KEY (encryption_root_id) REFERENCES pages(id) ON DELETE NO ACTION
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE pages DROP CONSTRAINT pages_encryption_root_id_fkey`.execute(
    db,
  );
  await sql`
    ALTER TABLE pages ADD CONSTRAINT pages_encryption_root_id_fkey
    FOREIGN KEY (encryption_root_id) REFERENCES pages(id) ON DELETE SET NULL
  `.execute(db);
}
