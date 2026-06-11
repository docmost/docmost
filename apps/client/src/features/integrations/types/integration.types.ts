export interface IntegrationResourceUrlPattern {
  /** Regex source matched after the connection base URL; named groups feed `resourceKey`. */
  pattern: string;
  /** Resource key template, e.g. 'id:{id}'. */
  resourceKey: string;
}

export interface IntegrationResourceManifest {
  id: string;
  title: string;
  description?: string;
  renderKind: "item-card" | "table-report";
  searchTerms: string[];
  picker?: {
    placeholder?: string;
    emptyLabel?: string;
    searchOnEmpty?: boolean;
  };
  menu?: {
    title: string;
    description?: string;
    searchTerms?: string[];
    icon?: "link" | "table";
  };
  urlPatterns?: IntegrationResourceUrlPattern[];
}

export interface IntegrationConnectionSettingField {
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
}

export interface IntegrationOAuthConnection {
  integrationId: string;
  providerId: string;
  name: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  configured: boolean;
  source?: "workspace" | "env";
  baseUrl?: string;
  baseUrlPlaceholder?: string;
  oauthClientId?: string;
  hasClientSecret: boolean;
  settings?: Record<string, string>;
  settingsFields: IntegrationConnectionSettingField[];
  redirectUri: string;
  scopes: string[];
}

export interface SaveIntegrationOAuthConnectionInput {
  enabled?: boolean;
  baseUrl: string;
  oauthClientId: string;
  oauthClientSecret?: string | null;
  settings?: Record<string, string>;
}

export interface IntegrationListItem {
  id: string;
  providerId: string;
  name: string;
  description?: string;
  icon?: string;
  baseUrl: string;
  scopes: string[];
  connected: boolean;
  needsReconnect: boolean;
  connectedAt?: string;
  expiresAt?: string;
  resources?: IntegrationResourceManifest[];
}
