export interface OAuth2TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
}

export interface OAuth2Identity {
  id: string;
  name: string;
}

// Describes an OAuth2 provider; register one with the Oauth2ProviderRegistry
// and the generic service handles authorize/callback/refresh/storage.
export interface OAuth2Provider {
  /** stable key used in routes and storage, e.g. "linear" */
  readonly key: string;
  readonly displayName: string;
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly revokeUrl?: string;
  /** provider-formatted scope string (comma- or space-separated as the provider expects) */
  readonly scopes: string;
  /** extra params appended to the authorize URL, e.g. { actor: "user" } */
  readonly authorizeExtraParams?: Record<string, string>;
  /** fetch the connected account's identity for display, using its access token */
  fetchIdentity(accessToken: string): Promise<OAuth2Identity>;
}
