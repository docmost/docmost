export interface IOAuthConnectionStatus {
  connected: boolean;
  configured: boolean;
  accountName?: string | null;
}

export interface IOAuthAppConfig {
  configured: boolean;
  clientId?: string;
  // authoritative OAuth callback URL to register with the provider (server-derived)
  redirectUri?: string;
}
