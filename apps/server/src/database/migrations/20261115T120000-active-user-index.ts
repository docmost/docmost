import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_active_id
    ON users (id)
    WHERE deactivated_at IS NULL
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_users_active_id').ifExists().execute();
}
