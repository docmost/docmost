import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add a new column for the simple tsvector
  await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS tsv_simple tsvector`.execute(db);

  // Create trigger function for simple config
  await sql`
    CREATE OR REPLACE FUNCTION pages_tsvector_simple_trigger() RETURNS trigger AS $$
    begin
        new.tsv_simple :=
                  setweight(to_tsvector('simple', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('simple', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  // Attach trigger to run before insert/update
  await sql`
    CREATE TRIGGER tsvectorupdate_simple
    BEFORE INSERT OR UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION pages_tsvector_simple_trigger();
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS tsvectorupdate_simple ON pages`.execute(db);
  await sql`DROP FUNCTION IF EXISTS pages_tsvector_simple_trigger()`.execute(db);
  await sql`ALTER TABLE pages DROP COLUMN IF EXISTS tsv_simple`.execute(db);
}
