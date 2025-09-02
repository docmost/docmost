import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // switch type to text column since you can't add value to PG types in a transaction
  await db.schema
    .alterTable('auth_providers')
    .alterColumn('type', (col) => col.setDataType('text'))
    .execute();

  await db.schema.dropType('auth_provider_type').ifExists().execute();

  await db.schema
    .alterTable('users')
    .addColumn('has_generated_password', 'boolean', (col) =>
      col.notNull().defaultTo(false).ifNotExists(),
    )
    .execute();

  await db.schema
    .alterTable('auth_providers')
    .addColumn('ldap_url', 'varchar', (col) => col)
    .addColumn('ldap_bind_dn', 'varchar', (col) => col)
    .addColumn('ldap_bind_password', 'varchar', (col) => col)
    .addColumn('ldap_base_dn', 'varchar', (col) => col)
    .addColumn('ldap_user_search_filter', 'varchar', (col) => col)
    .addColumn('ldap_user_attributes', 'jsonb', (col) =>
      col.defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('ldap_tls_enabled', 'boolean', (col) => col.defaultTo(false))
    .addColumn('ldap_tls_ca_cert', 'text', (col) => col)
    .addColumn('ldap_config', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('settings', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('has_generated_password')
    .execute();

  await db.schema
    .alterTable('auth_providers')
    .dropColumn('ldap_url')
    .dropColumn('ldap_bind_dn')
    .dropColumn('ldap_bind_password')
    .dropColumn('ldap_base_dn')
    .dropColumn('ldap_user_search_filter')
    .dropColumn('ldap_user_attributes')
    .dropColumn('ldap_tls_enabled')
    .dropColumn('ldap_tls_ca_cert')
    .dropColumn('ldap_config')
    .dropColumn('settings')
    .execute();

  await db.schema
    .createType('auth_provider_type')
    .asEnum(['saml', 'oidc', 'google'])
    .execute();

  await db.deleteFrom('auth_providers').where('type', '=', 'ldap').execute();

  await sql`
    ALTER TABLE auth_providers 
    ALTER COLUMN type TYPE auth_provider_type 
    USING type::auth_provider_type
  `.execute(db);
}
