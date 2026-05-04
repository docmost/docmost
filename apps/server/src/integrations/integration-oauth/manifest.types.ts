/**
 * Schema for a third-party integration's OAuth + identity contract.
 *
 * Borrowed from the omni connector platform's `OAuthManifestConfig`
 * (web/src/lib/server/oauth/connectorOAuth.ts) — that pattern is battle-tested
 * across Google / Microsoft / Atlassian / Linear / Notion / Slack and we get
 * its semantics for free if we adopt the same fields.
 *
 * Each integration ships exactly one of these from its NestJS module and
 * registers it into IntegrationOAuthRegistry at boot. A single-callback
 * controller dispatches by the `id` carried in the OAuth state token.
 */
export interface IntegrationManifest {
  /** Stable identifier — used in URLs, the token table's integration_id column, env vars. */
  id: string;

  /** Human-readable name for the settings UI. */
  name: string;

  /** Short description rendered on the connection card. */
  description?: string;

  /** Provider base URL (e.g. https://windshift.example.com). May resolve at request time. */
  baseUrl: string | (() => string);

  /** Path under baseUrl for the authorization endpoint (e.g. /oauth/authorize). */
  authorizePath: string;

  /** Path under baseUrl for the token endpoint (e.g. /api/oauth/token). */
  tokenPath: string;

  /** Optional userinfo endpoint for principal-email enrichment. */
  userinfoPath?: string;

  /** Field name on the userinfo response that contains the user's email. */
  userinfoEmailField?: string;

  /** Scopes requested at authorize time. */
  scopes: string[];

  /** Scope separator on the wire (typically ' '; some providers use ','). */
  scopeSeparator?: string;

  /** Extra params appended to the authorize URL (e.g. prompt=consent). */
  extraAuthParams?: Record<string, string>;

  /** Whether to send PKCE (S256). Required for public clients; recommended for confidential. */
  pkce?: boolean;

  /** Env var name for the OAuth client_id. */
  clientIdEnv: string;

  /** Env var name for the OAuth client_secret (omit for public clients). */
  clientSecretEnv?: string;

  /** Optional icon URL or data URL. */
  icon?: string;
}

/** Resolves IntegrationManifest.baseUrl whether it's a literal or a thunk. */
export function resolveBaseUrl(manifest: IntegrationManifest): string {
  const raw = typeof manifest.baseUrl === 'function' ? manifest.baseUrl() : manifest.baseUrl;
  return raw.replace(/\/+$/, '');
}
