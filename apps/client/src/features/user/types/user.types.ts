import { IWorkspace } from "@/features/workspace/types/workspace.types";

export interface IUser {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date;
  avatarUrl: string;
  timezone: string;
  settings: any;
  invitedById: string;
  lastLoginAt: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  workspaceId: string;
  deactivatedAt: Date;
  deletedAt: Date;
}

export interface ICurrentUser {
  user: IUser;
  workspace: IWorkspace;
}
