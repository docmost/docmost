import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create unaccent extension
  await sql`CREATE EXTENSION IF NOT EXISTS unaccent`.execute(db);

  // Create pg_trgm extension
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);

  // Create IMMUTABLE wrapper function for unaccent
  // This allows us to create indexes on unaccented columns for better performance
  // https://stackoverflow.com/a/11007216/8299075
  await sql`
    CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
    AS $$
      SELECT unaccent('unaccent', $1);
    $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
  `.execute(db);

  // Update the pages tsvector trigger to use the immutable function
  await sql`
    CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
                  setweight(to_tsvector('english', coalesce(new.text_content, '')), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`DROP FUNCTION IF EXISTS f_unaccent(text)`.execute(db);

  await sql`DROP EXTENSION IF EXISTS pg_trgm`.execute(db);

  await sql`DROP EXTENSION IF EXISTS unaccent`.execute(db);
}
