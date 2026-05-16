export interface IntegrationListItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  scopes: string[];
  connected: boolean;
  needsReconnect: boolean;
  connectedAt?: string;
  expiresAt?: string;
}
