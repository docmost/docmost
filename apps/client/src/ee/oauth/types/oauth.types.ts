export interface IOAuthAuthorizeInfo {
  clientName: string;
  redirectUri: string;
  scopes: string[];
  clientCreatedAt: string;
  verified: boolean;
}

export interface IOAuthGrant {
  id: string;
  clientName: string;
  redirectUris: string[];
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export type IAuthorizeParams = Record<string, string>;

export type IApproveAuthorizationPayload = {
  [param: string]: unknown;
  approved: boolean;
  approvedScopes?: string[];
};
