import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user_page_preferences')
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade'),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .addColumn('color', 'varchar')
    .addPrimaryKeyConstraint('user_page_preferences_user_id_page_id_pk', [
      'user_id',
      'page_id',
    ])
    .addColumn('position', 'varchar')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('user_page_preferences').execute();
}
