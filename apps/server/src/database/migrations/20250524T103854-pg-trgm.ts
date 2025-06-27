import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP EXTENSION IF EXISTS pg_trgm;`.execute(db);
}
