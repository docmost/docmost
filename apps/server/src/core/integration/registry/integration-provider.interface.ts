export type IntegrationCapability = 'oauth' | 'unfurl' | 'actions' | 'webhooks';

export type OAuthConfig = {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
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

  handleEvent?(opts: HandleEventOpts): Promise<void>;
}
