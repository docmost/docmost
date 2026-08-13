export type IntegrationCapability = 'oauth' | 'unfurl' | 'actions';

export type OAuthConfig = {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  // 'workspace' = one shared bot/app connection per integration (Slack model);
  // 'user' (default) = each Docmost user OAuths separately and gets their own token (Linear, Jira, GitHub model)
  connectionScope?: 'workspace' | 'user';
};

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
  // Kept out of the available list and refused for install; existing
  // installations keep unfurling.
  hidden?: boolean;
  // Install requires the INTEGRATIONS license feature; unset = free.
  requiresLicense?: boolean;
};

export type ConnectedEvent = {
  integrationId: string;
  workspaceId: string;
  accessToken: string;
  refreshToken?: string;
  // The Docmost user who completed the OAuth flow (installer for
  // workspace-scoped providers).
  userId: string;
  metadata: Record<string, any>;
};

export type HandleEventOpts = {
  eventName: string;
  payload: Record<string, any>;
  integration: {
    id: string;
    type: string;
    settings: Record<string, any> | null;
  };
  connection?: {
    accessToken: string;
    userId: string;
  };
};

export type UnfurlOpts = {
  url: string;
  accessToken: string;
  match: RegExpMatchArray;
  patternType: string;
  settings?: Record<string, any>;
  // The requesting Docmost user and integration. Providers backed by a shared
  // (workspace) connection MUST authorize the requester against the target
  // resource before returning content: the shared bot token is not itself
  // proof that the requester may see it.
  userId: string;
  integrationId: string;
};

// Thrown by a provider's unfurl() when the requesting user is not authorized
// to view the linked resource. UnfurlService turns it into a null result
// (no card) rather than logging it as an error.
export class UnfurlForbiddenError extends Error {
  constructor(message = 'Not authorized to unfurl this link') {
    super(message);
    this.name = 'UnfurlForbiddenError';
  }
}

// Thrown by a provider's unfurl() when the requesting user has no usable
// identity with the provider yet (e.g. no Slack account link). UnfurlService
// turns it into a needs-connection response, unlike UnfurlForbiddenError
// which stays a silent null.
export class UnfurlNeedsConnectionError extends Error {
  constructor(message = 'User has not connected this integration') {
    super(message);
    this.name = 'UnfurlNeedsConnectionError';
  }
}

// Thrown when the provider definitively rejects the stored credential (API 401,
// or invalid_grant at the token endpoint). Callers retire the connection.
export class TokenInvalidError extends Error {
  constructor(message = 'Integration credential is no longer valid') {
    super(message);
    this.name = 'TokenInvalidError';
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

// Returned instead of an UnfurlResult when the link needs a per-user
// connection the requesting user does not have yet.
export type UnfurlNeedsConnection = {
  needsConnection: true;
  integrationId: string;
  integrationType: string;
  integrationName: string;
  // true when a Docmost-initiated OAuth flow yields a personal connection
  // for the requesting user (all OAuth-capable providers; workspace-scoped
  // ones bind the authorizing user's identity in onConnected).
  oauthConnect: boolean;
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

  onConnected?(opts: ConnectedEvent): Promise<void>;

  unfurl?(opts: UnfurlOpts): Promise<UnfurlResult>;

  // Tokenless summary of a matched link (e.g. "Pull Request #13337"),
  // shown on the connect prompt before the user has authorized.
  describeLink?(
    patternType: string,
    match: RegExpMatchArray,
    url: string,
  ): LinkDescription | null;

  handleEvent?(opts: HandleEventOpts): Promise<void>;
}
