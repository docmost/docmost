export interface IOidcProvider {
  id: string;
  name: string;
  slug: string;
  type: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcRedirectUri: string;
  domains: string[];
  autoJoinByEmail: boolean;
  autoCreateUsers: boolean;
  isEnabled: boolean;
  hasClientSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateOidcProvider {
  name: string;
  slug: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  domains?: string[];
  autoJoinByEmail?: boolean;
  autoCreateUsers?: boolean;
}

export interface IUpdateOidcProvider {
  name?: string;
  slug?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  domains?: string[];
  autoJoinByEmail?: boolean;
  autoCreateUsers?: boolean;
}
