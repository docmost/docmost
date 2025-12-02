import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('auth_providers')
    .addColumn('scope', 'varchar', (col) =>
      col.defaultTo('openid email profile').notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('auth_providers').dropColumn('scope').execute();
}
