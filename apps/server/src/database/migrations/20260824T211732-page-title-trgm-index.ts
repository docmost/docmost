import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE INDEX IF NOT EXISTS pages_title_trgm_idx ON pages USING gin (lower(f_unaccent(title)) gin_trgm_ops)`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS pages_title_trgm_idx`.execute(db);
}
