import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('services')
    .addColumn('doc_version', 'varchar(20)', (col) =>
      col.notNull().defaultTo('0.0.0'),
    )
    .execute();

  await db.schema
    .alterTable('change_requests')
    .addColumn('doc_version', 'varchar(20)')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('change_requests')
    .dropColumn('doc_version')
    .execute();

  await db.schema.alterTable('services').dropColumn('doc_version').execute();
}
