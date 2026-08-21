import { type Kysely, sql } from 'kysely';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('favorites')
    .addColumn('position', 'varchar', (col) => col)
    .execute();

  // Backfill existing rows, preserving today's display order (newest
  // favorite first, i.e. id desc — id is a time-sortable uuid_v7) so nothing
  // visually reshuffles the moment this ships. Grouped per (user, workspace,
  // type) since that's the scope favorites are ordered/listed within.
  const groups = await db
    .selectFrom('favorites')
    .select(['user_id', 'workspace_id', 'type'])
    .distinct()
    .execute();

  for (const group of groups) {
    const rows = await db
      .selectFrom('favorites')
      .select(['id'])
      .where('user_id', '=', group.user_id)
      .where('workspace_id', '=', group.workspace_id)
      .where('type', '=', group.type)
      .orderBy('id', 'desc')
      .execute();

    let position: string | null = null;
    for (const row of rows) {
      position = generateJitteredKeyBetween(position, null);
      await db
        .updateTable('favorites')
        .set({ position })
        .where('id', '=', row.id)
        .execute();
    }
  }

  await db.schema
    .alterTable('favorites')
    .alterColumn('position', (col) => col.setNotNull())
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_favorites_user_workspace_type_position
      ON favorites (user_id, workspace_id, type, position COLLATE "C")
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_favorites_user_workspace_type_position`.execute(
    db,
  );
  await db.schema.alterTable('favorites').dropColumn('position').execute();
}
