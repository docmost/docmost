import { type Kysely, sql } from 'kysely';

/*
 * Adds `pending_type` / `pending_type_options` to `base_properties` so
 * async type conversions can run without flipping the live type prematurely.
 * The worker swaps them onto `type` / `type_options` in the same
 * transaction that bumps schema_version, so clients never observe raw IDs
 * under a post-conversion type.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE base_properties
      ADD COLUMN IF NOT EXISTS pending_type         varchar,
      ADD COLUMN IF NOT EXISTS pending_type_options jsonb
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE base_properties
      DROP COLUMN IF EXISTS pending_type_options,
      DROP COLUMN IF EXISTS pending_type
  `.execute(db);
}
