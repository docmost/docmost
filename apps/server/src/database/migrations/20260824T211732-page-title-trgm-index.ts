import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // f_unaccent must be schema-qualified in its body to be usable inside an index
  // expression: Postgres 15+ builds indexes under a secured search_path
  // (pg_catalog, pg_temp), so an unqualified unaccent() cannot be resolved during
  // CREATE INDEX. Redefine f_unaccent in place (in whatever schema it already
  // lives) with the unaccent function and dictionary both qualified.
  await sql`
    DO $migration$
    DECLARE ext_schema text;
    BEGIN
    SELECT n.nspname INTO ext_schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'unaccent';

    EXECUTE format(
      'CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text '
        || 'LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT '
        || 'AS $f$ SELECT %I.unaccent(%L::regdictionary, $1) $f$',
      ext_schema, ext_schema || '.unaccent');
    END
    $migration$;
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS pages_title_trgm_idx ON pages USING gin (lower(f_unaccent(title)) gin_trgm_ops)`.execute(
    db,
  );

  // separators normalized to spaces so space-typed queries match How_to_export.pdf
  await sql`CREATE INDEX IF NOT EXISTS attachments_file_name_trgm_idx ON attachments USING gin (lower(f_unaccent(translate(file_name, '_.-', '   '))) gin_trgm_ops)`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS attachments_file_name_trgm_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS pages_title_trgm_idx`.execute(db);
}
