import { type Kysely, sql } from "kysely";

/*
 * Enforce one property name per base (case-insensitive, excluding soft-deleted).
 * Formulas reference properties by name via `prop("Name")`, and the resolver
 * builds a `Map<name, id>` — duplicates would silently clobber and make
 * references non-deterministic. Belt-and-suspenders against races that slip
 * past service-layer validation.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX base_properties_name_unique
    ON base_properties (base_id, lower(name))
    WHERE deleted_at IS NULL
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS base_properties_name_unique`.execute(db);
}
