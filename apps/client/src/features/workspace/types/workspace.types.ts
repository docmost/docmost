import { IAuthProvider } from "@/ee/security/types/security.types.ts";

export interface IWorkspace {
  id: string;
  name: string;
  description: string;
  logo: string;
  hostname: string;
  defaultSpaceId: string;
  customDomain: string;
  enableInvite: boolean;
  settings: any;
  status: string;
  enforceSso: boolean;
  stripeCustomerId: string;
  billingEmail: string;
  trialEndAt: Date;
  createdAt: Date;
  updatedAt: Date;
  emailDomains: string[];
  memberCount?: number;
  plan?: string;
  hasLicenseKey?: boolean;
  enforceMfa?: boolean;
}

export interface ICreateInvite {
  role: string;
  emails: string[];
  groupIds: string[];
}

export interface IInvitation {
  id: string;
  role: string;
  email: string;
  workspaceId: string;
  invitedById: string;
  createdAt: Date;
  enforceSso: boolean;
}

export interface IInvitationLink {
  inviteLink: string;
}

export interface IAcceptInvite {
  invitationId: string;
  name: string;
  password: string;
  token: string;
}

export interface IPublicWorkspace {
  id: string;
  name: string;
  logo: string;
  hostname: string;
  enforceSso: boolean;
  authProviders: IAuthProvider[];
  hasLicenseKey?: boolean;
}

export interface IVersion {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
}
