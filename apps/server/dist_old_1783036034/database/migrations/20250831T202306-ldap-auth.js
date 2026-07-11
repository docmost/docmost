"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .alterTable('auth_providers')
        .alterColumn('type', (col) => col.setDataType('text'))
        .execute();
    await db.schema.dropType('auth_provider_type').ifExists().execute();
    await db.schema
        .alterTable('users')
        .addColumn('has_generated_password', 'boolean', (col) => col.notNull().defaultTo(false).ifNotExists())
        .execute();
    await db.schema
        .alterTable('auth_providers')
        .addColumn('ldap_url', 'varchar', (col) => col)
        .addColumn('ldap_bind_dn', 'varchar', (col) => col)
        .addColumn('ldap_bind_password', 'varchar', (col) => col)
        .addColumn('ldap_base_dn', 'varchar', (col) => col)
        .addColumn('ldap_user_search_filter', 'varchar', (col) => col)
        .addColumn('ldap_user_attributes', 'jsonb', (col) => col.defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
        .addColumn('ldap_tls_enabled', 'boolean', (col) => col.defaultTo(false))
        .addColumn('ldap_tls_ca_cert', 'text', (col) => col)
        .addColumn('ldap_config', 'jsonb', (col) => col.defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
        .addColumn('settings', 'jsonb', (col) => col.defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
        .execute();
}
async function down(db) {
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
    await (0, kysely_1.sql) `
    ALTER TABLE auth_providers 
    ALTER COLUMN type TYPE auth_provider_type 
    USING type::auth_provider_type
  `.execute(db);
}
//# sourceMappingURL=20250831T202306-ldap-auth.js.map