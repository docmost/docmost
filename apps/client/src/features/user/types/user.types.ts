import { IWorkspace } from "@/features/workspace/types/workspace.types";

export interface IUser {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date;
  avatarUrl: string;
  timezone: string;
  settings: any;
  lastLoginAt: string;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  workspaceId: string;
}

export interface ICurrentUser {
  user: IUser,
  workspace: IWorkspace
}
