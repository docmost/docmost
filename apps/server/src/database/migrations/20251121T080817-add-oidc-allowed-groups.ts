import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('auth_providers')
    .addColumn('oidc_allowed_groups', 'text')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('auth_providers')
    .dropColumn('oidc_allowed_groups')
    .execute();
}
