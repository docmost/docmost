import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .addColumn('node_type', 'varchar', (col) =>
      col.notNull().defaultTo('page'),
    )
    .execute();

  await db.executeQuery(
    sql`
      alter table pages
      add constraint pages_node_type_check
      check (node_type in ('page', 'folder'))
    `.compile(db),
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.executeQuery(
    sql`
      alter table pages
      drop constraint if exists pages_node_type_check
    `.compile(db),
  );

  await db.schema.alterTable('pages').dropColumn('node_type').execute();
}
