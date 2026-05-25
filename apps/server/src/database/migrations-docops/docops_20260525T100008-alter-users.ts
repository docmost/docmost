import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('office_id', 'uuid', (col) => col.references('offices.id'))
    .execute();

  await db.schema
    .alterTable('users')
    .addColumn('docops_roles', sql`varchar[]`, (col) =>
      col.defaultTo(sql`'{}'::varchar[]`),
    )
    .execute();

  await db.schema
    .alterTable('users')
    .addColumn('external_id', 'varchar', (col) => col)
    .execute();

  await db.schema
    .alterTable('users')
    .addColumn('auth_provider', 'varchar', (col) => col.defaultTo('local'))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('users').dropColumn('auth_provider').execute();
  await db.schema.alterTable('users').dropColumn('external_id').execute();
  await db.schema.alterTable('users').dropColumn('docops_roles').execute();
  await db.schema.alterTable('users').dropColumn('office_id').execute();
}
