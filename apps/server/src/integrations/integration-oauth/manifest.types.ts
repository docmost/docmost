/**
 * OAuth + identity contract for a third-party integration. Each consumer
 * module declares one of these and registers it with IntegrationOAuthRegistry
 * at boot.
 */
import { IntegrationResourceManifest } from './resource.types';

/**
 * Provider-defined connection setting rendered generically in the admin
 * connection form and persisted in the connection's `settings` JSON blob.
 */
export interface IntegrationConnectionSettingField {
  /** Key in the connection settings object. */
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  /** Regex source the trimmed value must match (anchor it yourself). */
  pattern?: string;
  /** Normalization applied before validation and storage. */
  transform?: 'uppercase' | 'lowercase';
}

export interface IntegrationManifest {
  /** Stable identifier — used in URLs, env vars, and the token table. */
  id: string;
  /** Display name for the settings UI. */
  name: string;
  description?: string;
  /** Provider base URL. A thunk lets env-driven values resolve at request time. */
  baseUrl: string | (() => string);
  /** Placeholder for the admin connection form's base URL input. */
  baseUrlPlaceholder?: string;
  /** e.g. /oauth/authorize */
  authorizePath: string;
  /** e.g. /api/oauth/token */
  tokenPath: string;
  scopes: string[];
  /** Defaults to ' '. Some providers use ','. */
  scopeSeparator?: string;
  /** Extra authorize-URL params (e.g. prompt=consent). */
  extraAuthParams?: Record<string, string>;
  /** PKCE S256. Required for public clients; recommended for confidential. */
  pkce?: boolean;
  /** Env var holding the OAuth client_id. */
  clientIdEnv: string;
  /** Env var holding the OAuth client_secret (omit for public clients). */
  clientSecretEnv?: string;
  icon?: string;
  /** Extra admin-configured connection settings, rendered generically. */
  connectionSettings?: IntegrationConnectionSettingField[];
  /** Safe editor resources exposed through the generic integration surface. */
  resources?: IntegrationResourceManifest[];
}

/** Resolves IntegrationManifest.baseUrl whether it's a literal or a thunk. */
export function resolveBaseUrl(manifest: IntegrationManifest): string {
  const raw = typeof manifest.baseUrl === 'function' ? manifest.baseUrl() : manifest.baseUrl;
  return raw.replace(/\/+$/, '');
}
