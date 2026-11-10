import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE pages AS child
    SET parent_page_id = NULL
    FROM pages AS parent
    WHERE child.parent_page_id = parent.id
      AND child.space_id <> parent.space_id
  `.execute(db);
}

export async function down(): Promise<void> {
  // detached pages stay at the root of their own space
}
