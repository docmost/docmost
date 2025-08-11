import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add last_edited_by_id column to comments table
  await db.schema
    .alterTable('comments')
    .addColumn('last_edited_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .execute();

  // Add resolved_by_id column to comments table
  await db.schema
    .alterTable('comments')
    .addColumn('resolved_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .execute();

  // Add updated_at timestamp column to comments table
  await db.schema
    .alterTable('comments')
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Add space_id column to comments table
  await db.schema
    .alterTable('comments')
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade'),
    )
    .execute();

  // Backfill space_id from the related pages
  await db
    .updateTable('comments as c')
    .set((eb) => ({
      space_id: eb.ref('p.space_id'),
    }))
    .from('pages as p')
    .whereRef('c.page_id', '=', 'p.id')
    .execute();

  // Make space_id NOT NULL after populating data
  await db.schema
    .alterTable('comments')
    .alterColumn('space_id', (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('comments')
    .dropColumn('last_edited_by_id')
    .execute();
  await db.schema.alterTable('comments').dropColumn('resolved_by_id').execute();
  await db.schema.alterTable('comments').dropColumn('updated_at').execute();
  await db.schema.alterTable('comments').dropColumn('space_id').execute();
}
