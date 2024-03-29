import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
        begin
            new.tsv :=
                      setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
                      setweight(to_tsvector('english', coalesce(new.text_content, '')), 'B');
            return new;
        end;
        $$ LANGUAGE plpgsql;`.execute(db);

  await sql`CREATE OR REPLACE TRIGGER pages_tsvector_update BEFORE INSERT OR UPDATE
                ON pages FOR EACH ROW EXECUTE FUNCTION pages_tsvector_trigger();`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP trigger pages_tsvector_update ON pages`.execute(db);
  await sql`DROP FUNCTION pages_tsvector_trigger`.execute(db);
}
