import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .addColumn('is_encrypted', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn('encryption_meta', 'jsonb', (col) => col)
    .addColumn('encrypted_blob', 'bytea', (col) => col)
    .addColumn('encrypted_version', 'int8', (col) =>
      col.defaultTo(0).notNull(),
    )
    .execute();

  await db.schema
    .alterTable('page_history')
    .addColumn('is_encrypted', 'boolean', (col) =>
      col.defaultTo(false).notNull(),
    )
    .addColumn('encryption_meta', 'jsonb', (col) => col)
    .addColumn('encrypted_blob', 'bytea', (col) => col)
    .execute();

  // encrypted pages must never enter the full-text search index;
  // otherwise keep the 20250729 definition (f_unaccent + tsvector size cap)
  await sql`CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
        begin
            if new.is_encrypted then
                new.tsv := NULL;
                return new;
            end if;
            new.tsv :=
                      setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                      setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
            return new;
        end;
        $$ LANGUAGE plpgsql;`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // restore the 20250729 definition
  await sql`CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
        begin
            new.tsv :=
                      setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                      setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
            return new;
        end;
        $$ LANGUAGE plpgsql;`.execute(db);

  await db.schema
    .alterTable('page_history')
    .dropColumn('is_encrypted')
    .dropColumn('encryption_meta')
    .dropColumn('encrypted_blob')
    .execute();

  await db.schema
    .alterTable('pages')
    .dropColumn('is_encrypted')
    .dropColumn('encryption_meta')
    .dropColumn('encrypted_blob')
    .dropColumn('encrypted_version')
    .execute();
}
