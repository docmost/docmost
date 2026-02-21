import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';
import { workspaces } from './workspaces';
import { users } from './users';

export const authProviders = sqliteTable('auth_providers', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  type: text('type').notNull(),
  name: text('name').notNull(),
  settings: text('settings', { mode: 'json' }),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
  allowSignup: integer('allow_signup', { mode: 'boolean' }).notNull().default(false),
  groupSync: integer('group_sync', { mode: 'boolean' }).notNull().default(false),
  // LDAP specific
  ldapUrl: text('ldap_url'),
  ldapBaseDn: text('ldap_base_dn'),
  ldapBindDn: text('ldap_bind_dn'),
  ldapBindPassword: text('ldap_bind_password'),
  ldapTlsEnabled: integer('ldap_tls_enabled', { mode: 'boolean' }),
  ldapTlsCaCert: text('ldap_tls_ca_cert'),
  ldapUserSearchFilter: text('ldap_user_search_filter'),
  ldapUserAttributes: text('ldap_user_attributes', { mode: 'json' }),
  ldapConfig: text('ldap_config', { mode: 'json' }),
  // OIDC specific
  oidcClientId: text('oidc_client_id'),
  oidcClientSecret: text('oidc_client_secret'),
  oidcIssuer: text('oidc_issuer'),
  // SAML specific
  samlCertificate: text('saml_certificate'),
  samlUrl: text('saml_url'),
  creatorId: text('creator_id').references(() => users.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('auth_providers_workspace_idx').on(table.workspaceId),
  index('auth_providers_type_idx').on(table.type),
]);

export const authAccounts = sqliteTable('auth_accounts', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  userId: text('user_id').notNull().references(() => users.id),
  authProviderId: text('auth_provider_id').references(() => authProviders.id),
  providerUserId: text('provider_user_id').notNull(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('auth_accounts_user_idx').on(table.userId),
  index('auth_accounts_provider_idx').on(table.authProviderId),
  index('auth_accounts_workspace_idx').on(table.workspaceId),
]);
