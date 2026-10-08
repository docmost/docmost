import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE INDEX IF NOT EXISTS pages_title_trgm_idx ON pages USING gin (lower(title) gin_trgm_ops)`.execute(
    db,
  );

  // separators normalized to spaces so space-typed queries match How_to_export.pdf
  await sql`CREATE INDEX IF NOT EXISTS attachments_file_name_trgm_idx ON attachments USING gin (lower(translate(file_name, '_.-', '   ')) gin_trgm_ops)`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS attachments_file_name_trgm_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS pages_title_trgm_idx`.execute(db);
}
