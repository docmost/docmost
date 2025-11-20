export interface OidcProfile {
    sub: string;  // OIDC subject identifier
    email: string;
    name?: string;
    preferred_username?: string;
    given_name?: string;
    family_name?: string;
}

export interface OidcTokenSet {
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in?: number;
}
