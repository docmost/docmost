export type IntegrationCapability = "oauth" | "unfurl" | "actions";

export type OAuthConfig = {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  connectionScope?: 'workspace' | 'user';
};

export type IntegrationDefinition = {
  type: string;
  name: string;
  description: string;
  icon: string;
  capabilities: IntegrationCapability[];
  oauth?: OAuthConfig;
  requiresLicense?: boolean;
};

export type Integration = {
  id: string;
  workspaceId: string;
  type: string;
  settings: Record<string, any> | null;
  installedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionStatus = {
  connected: boolean;
  providerUserId?: string;
};

export type UserConnection = {
  integrationId: string;
  type: string;
  providerUserId: string | null;
  providerDisplayName: string | null;
  connectedAt: string;
  invalidatedAt: string | null;
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

// Returned when the link's provider needs a per-user connection the
// requesting user has not authorized yet.
export type UnfurlNeedsConnection = {
  needsConnection: true;
  integrationId: string;
  integrationType: string;
  integrationName: string;
  // false for workspace-scoped providers (Slack): linking happens on the
  // provider's side, so no Docmost-initiated OAuth button.
  oauthConnect: boolean;
  title: string;
  description?: string;
};
