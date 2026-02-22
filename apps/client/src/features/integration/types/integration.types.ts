export type IntegrationCapability = "oauth" | "unfurl" | "actions" | "webhooks";

export type IntegrationDefinition = {
  type: string;
  name: string;
  description: string;
  icon: string;
  capabilities: IntegrationCapability[];
};

export type Integration = {
  id: string;
  workspaceId: string;
  type: string;
  isEnabled: boolean;
  settings: Record<string, any> | null;
  installedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionStatus = {
  connected: boolean;
  providerUserId?: string;
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
