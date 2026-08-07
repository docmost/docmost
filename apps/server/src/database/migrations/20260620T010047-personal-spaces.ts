import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .addColumn('is_personal', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute();

  await sql`
    CREATE UNIQUE INDEX spaces_personal_creator_unique
    ON spaces (creator_id)
    WHERE is_personal = true AND deleted_at IS NULL
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('spaces_personal_creator_unique')
    .ifExists()
    .execute();
  await db.schema.alterTable('spaces').dropColumn('is_personal').execute();
}
