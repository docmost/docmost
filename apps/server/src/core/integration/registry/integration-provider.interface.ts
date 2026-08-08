export type IntegrationCapability = 'oauth' | 'unfurl' | 'actions' | 'webhooks';

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
};

export type ConnectedEvent = {
  integrationId: string;
  workspaceId: string;
  accessToken: string;
  refreshToken?: string;
  providerUserId: string;
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
