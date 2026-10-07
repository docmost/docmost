import { FeatureKey } from '../../../common/features';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';

export type IntegrationCapability = 'oauth' | 'unfurl' | 'actions';

// Proves which provider account a member holds, without granting API scopes.
export type IdentityOAuthConfig = {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  // Extra authorize-URL query params, e.g. Slack's team pin.
  authParams?: Record<string, string>;
};

export type OAuthConfig = {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  // 'workspace': one shared bot connection (Slack). 'user' (default): a token per Docmost user.
  connectionScope?: 'workspace' | 'user';
  // Env credential prefix shared by products on one authorization server (atlassian, google).
  credentialsKey?: string;
  // Repeat the scopes on refresh, for token endpoints that pick the resource from them (Microsoft Entra).
  scopeOnRefresh?: boolean;
  // Extra authorize-URL query params the provider's docs require, e.g. Atlassian's audience.
  authParams?: Record<string, string>;
  // Token refresh endpoint when the provider uses a separate one (Figma).
  refreshUrl?: string;
  // Send the client id and secret as HTTP Basic instead of in the body (Figma).
  clientAuth?: 'basic';
  // Without it, workspace-scoped members can only link from inside the provider.
  identity?: IdentityOAuthConfig;
};

export type IdentityLinkEvent = {
  integrationId: string;
  workspaceId: string;
  // The Docmost user linking their account.
  userId: string;
  tokenResponse: Record<string, any>;
  settings: Record<string, any>;
};

export type ResolvedIdentity = {
  providerUserId: string;
  // Verified email; must match the Docmost user's for the link to succeed.
  email?: string;
  metadata?: Record<string, unknown>;
};

export class IdentityEmailMismatchError extends Error {
  constructor(message = 'Provider account email does not match your account') {
    super(message);
    this.name = 'IdentityEmailMismatchError';
  }
}

// Thrown by resolveIdentity for an account outside the installed tenant.
export class IdentityTenantMismatchError extends Error {
  constructor(message = 'Provider account belongs to a different tenant') {
    super(message);
    this.name = 'IdentityTenantMismatchError';
  }
}

// Thrown by onConnected; inbound events must route to a single Docmost workspace.
export class IntegrationTenantInUseError extends Error {
  constructor(message = 'Provider tenant is already connected to another workspace') {
    super(message);
    this.name = 'IntegrationTenantInUseError';
  }
}

export type UnfurlPattern = {
  regex: RegExp;
  type: string;
};

export type UnfurlResult = {
  title: string;
  description?: string;
  url: string;
  provider: string;
  providerIcon?: string;
  status?: string;
  statusColor?: string;
  author?: string;
  authorAvatarUrl?: string;
  metadata?: Record<string, any>;
};

export type IntegrationDefinition = {
  type: string;
  name: string;
  description: string;
  icon: string;
  capabilities: IntegrationCapability[];
  oauth?: OAuthConfig;
  unfurlPatterns?: UnfurlPattern[];
  // Not installable, but existing installations keep unfurling.
  hidden?: boolean;
  // License feature the install is gated on; unset = free.
  requiresFeature?: FeatureKey;
};

export type ConnectedEvent = {
  integrationId: string;
  workspaceId: string;
  accessToken: string;
  refreshToken?: string;
  // The Docmost user who completed the install flow.
  userId: string;
  metadata: Record<string, any>;
  // Provider writes must use it so a throw rolls back the install.
  trx?: KyselyTransaction;
};

export type UnfurlOpts = {
  url: string;
  accessToken: string;
  match: RegExpMatchArray;
  patternType: string;
  settings?: Record<string, any>;
  // Shared-connection providers must check this user can see the resource.
  userId: string;
  integrationId: string;
};

// UnfurlService shows no card for it instead of logging an error.
export class UnfurlForbiddenError extends Error {
  constructor(message = 'Not authorized to unfurl this link') {
    super(message);
    this.name = 'UnfurlForbiddenError';
  }
}

// The user has no linked provider identity yet (e.g. no Slack account link).
export class UnfurlNeedsConnectionError extends Error {
  constructor(message = 'User has not connected this integration') {
    super(message);
    this.name = 'UnfurlNeedsConnectionError';
  }
}

// The provider rejected the stored credential (API 401 or invalid_grant).
export class TokenInvalidError extends Error {
  constructor(message = 'Integration credential is no longer valid') {
    super(message);
    this.name = 'TokenInvalidError';
  }
}

// The access token expired and the refresh job has not renewed it yet.
export class TokenExpiredError extends Error {
  constructor(message = 'Integration credential expired and awaits refresh') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class ProviderApiError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    statusText = '',
  ) {
    super(`${provider} API error: ${status} ${statusText}`.trimEnd());
    this.name = 'ProviderApiError';
  }
}

export type LinkDescription = {
  title: string;
  description?: string;
};

export type UnfurlNeedsConnection = {
  needsConnection: true;
  integrationId: string;
  integrationType: string;
  integrationName: string;
  title: string;
  description?: string;
};

export abstract class IntegrationProvider {
  abstract definition: IntegrationDefinition;

  getOAuthConfig?(
    workspaceSettings: Record<string, any>,
  ): OAuthConfig;

  getUnfurlPatterns?(
    workspaceSettings: Record<string, any>,
  ): UnfurlPattern[];

  // Lowercase hostnames the client offers cards on; "*.example.com" matches any subdomain.
  getUnfurlHosts?(workspaceSettings: Record<string, any>): string[];

  onConnected?(opts: ConnectedEvent): Promise<void>;

  // Maps an identity-flow token response to a provider account in the installed tenant.
  resolveIdentity?(opts: IdentityLinkEvent): Promise<ResolvedIdentity>;

  unfurl?(opts: UnfurlOpts): Promise<UnfurlResult>;

  // Tokenless summary for the connect prompt, e.g. "Pull Request #13337".
  describeLink?(
    patternType: string,
    match: RegExpMatchArray,
    url: string,
  ): LinkDescription | null;
}
