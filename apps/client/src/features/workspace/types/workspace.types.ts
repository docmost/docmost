export interface IOIDCConfig {
  enabled: boolean;
  buttonName: string;
}
export interface IWorkspace {
  id: string;
  name: string;
  description: string;
  logo: string;
  inviteCode: string;
  oidcEnabled: boolean;
  oidcButtonName: string;
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
