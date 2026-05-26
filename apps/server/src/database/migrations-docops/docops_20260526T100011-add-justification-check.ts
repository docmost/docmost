import { type Kysely, sql } from 'kysely';

// Enforces minimum 30-character justification on change requests.
// Cannot be expressed via Kysely schema builder; uses raw SQL.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE change_requests
    ADD CONSTRAINT chk_cr_justification_length
    CHECK (char_length(justification) >= 30)
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    ALTER TABLE change_requests
    DROP CONSTRAINT chk_cr_justification_length
  `.execute(db);
}
