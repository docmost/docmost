import { type Kysely, sql } from "kysely";

/*
 * The `base_properties.type` column is varchar with no CHECK constraint
 * in the current schema, so runtime validation of 'formula' happens entirely
 * in the Zod layer (base.schemas.ts). This migration is intentionally empty —
 * it exists to mark the formula property type release in the migration log.
 */
export async function up(_db: Kysely<any>): Promise<void> {
  // no-op — formula type allowed at Zod layer
}

export async function down(_db: Kysely<any>): Promise<void> {
  // no-op
}
