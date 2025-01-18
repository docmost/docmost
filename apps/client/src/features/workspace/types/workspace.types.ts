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
  billingEmail: string;
  trialEndAt: Date;
  createdAt: Date;
  updatedAt: Date;
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
}

export interface IAcceptInvite {
  invitationId: string;
  name: string;
  password: string;
  token: string;
}
