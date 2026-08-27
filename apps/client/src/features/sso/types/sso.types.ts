export interface IGoogleSsoConfig {
  id: string;
  isEnabled: boolean;
  allowSignup: boolean;
  groupSync: boolean;
  /** Whether GOOGLE_CLIENT_ID / SECRET are set on the server. */
  credentialsConfigured: boolean;
  /** Whether GOOGLE_SERVICE_ACCOUNT_KEY is set on the server. */
  groupSyncConfigured: boolean;
  callbackUrl: string;
}

export interface IGroupMapping {
  id: string;
  authProviderId: string;
  workspaceId: string;
  externalGroupKey: string;
  groupId: string;
  groupName: string;
  role: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IMappingPreview {
  groupName: string;
  googleMemberCount: number;
  wouldAdd: number;
  alreadyMembers: number;
  manualMembersUnaffected: number;
  withoutDocmostAccount: number;
}

export interface IWizardMapping {
  externalGroupKey: string;
  groupId: string;
  role?: string;
}
