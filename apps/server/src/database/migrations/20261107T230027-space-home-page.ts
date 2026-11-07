import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('spaces')
    .addColumn('home_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'),
    )
    .execute();

  await db.schema
    .createIndex('idx_spaces_home_page_id')
    .on('spaces')
    .column('home_page_id')
    .where(sql.ref('home_page_id'), 'is not', null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_spaces_home_page_id').execute();

  await db.schema.alterTable('spaces').dropColumn('home_page_id').execute();
}
