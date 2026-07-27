import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Points an encrypted descendant at the page holding the subtree's
  // encryption_meta (wrapped DEK). NULL means the page is self-rooted:
  // either plaintext, or an encryption root carrying its own meta.
  await db.schema
    .alterTable('pages')
    .addColumn('encryption_root_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'),
    )
    .execute();

  await db.schema
    .createIndex('pages_encryption_root_id_idx')
    .on('pages')
    .column('encryption_root_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('pages_encryption_root_id_idx').execute();

  await db.schema
    .alterTable('pages')
    .dropColumn('encryption_root_id')
    .execute();
}
