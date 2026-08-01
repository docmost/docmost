import { type Kysely, sql } from 'kysely';

/**
 * Encrypted sections: a subtree of pages sharing one key.
 *
 * The root page carries the wrapped DEK in encryption_meta; every other page
 * in the section points at the root through encryption_root_id. NULL means the
 * page is self-rooted — either plaintext, or a root carrying its own meta.
 *
 * ON DELETE NO ACTION, deliberately, and not the more obvious alternatives:
 *
 *  - SET NULL would null out the pointer on any page still keyed to a
 *    hard-deleted root, leaving an encrypted page with no reachable DEK —
 *    silently unreadable ciphertext, and a violation of the
 *    pages_encrypted_page_has_a_key check below.
 *  - RESTRICT is checked immediately, so it would fire on the very rows a
 *    cascade is in the middle of deleting.
 *
 * NO ACTION is checked at the end of the statement, so the normal case works:
 * pages.parent_page_id is ON DELETE CASCADE, so purging a root deletes the
 * pages keyed to it in the same statement and no referencing row is left. Only
 * a page that somehow outlived its section blocks the delete — loudly, rather
 * than being quietly stranded.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE pages ADD COLUMN encryption_root_id uuid
    REFERENCES pages(id) ON DELETE NO ACTION
  `.execute(db);

  await db.schema
    .createIndex('pages_encryption_root_id_idx')
    .on('pages')
    .column('encryption_root_id')
    .execute();

  /*
   * The section invariants, enforced by the database rather than only by the
   * conversion service: a keyed page must be encrypted and must NOT carry its
   * own key, and an encrypted page must have a key reachable one way or the
   * other. This closes paths the service never sees — page restore, imports,
   * and any future direct insert.
   *
   * Added NOT VALID, then validated separately: ADD CONSTRAINT ... CHECK holds
   * an ACCESS EXCLUSIVE lock for a full table scan, while VALIDATE CONSTRAINT
   * takes a weaker lock that does not block reads and writes. New rows are
   * checked from the moment the constraint exists either way.
   */
  await sql`
    ALTER TABLE pages ADD CONSTRAINT pages_keyed_page_has_no_own_key
    CHECK (
      encryption_root_id IS NULL
      OR (is_encrypted AND encryption_meta IS NULL)
    ) NOT VALID
  `.execute(db);

  await sql`
    ALTER TABLE pages ADD CONSTRAINT pages_encrypted_page_has_a_key
    CHECK (
      NOT is_encrypted
      OR encryption_root_id IS NOT NULL
      OR encryption_meta IS NOT NULL
    ) NOT VALID
  `.execute(db);

  await sql`ALTER TABLE pages VALIDATE CONSTRAINT pages_keyed_page_has_no_own_key`.execute(
    db,
  );
  await sql`ALTER TABLE pages VALIDATE CONSTRAINT pages_encrypted_page_has_a_key`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE pages DROP CONSTRAINT pages_encrypted_page_has_a_key`.execute(
    db,
  );
  await sql`ALTER TABLE pages DROP CONSTRAINT pages_keyed_page_has_no_own_key`.execute(
    db,
  );

  await db.schema.dropIndex('pages_encryption_root_id_idx').execute();

  await db.schema
    .alterTable('pages')
    .dropColumn('encryption_root_id')
    .execute();
}
