export interface IWorkspace {
  id: string;
  name: string;
  description: string;
  logo: string;
  hostname: string;
  customDomain: string;
  enableInvite: boolean;
  inviteCode: string;
  settings: any;
  creatorId: string;
  pageOrder?:[]
  createdAt: Date;
  updatedAt: Date;
}
