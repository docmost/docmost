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
  lastLoginIp: string;
  createdAt: Date;
  updatedAt: Date;
  workspaceRole?: string;
}

export interface ICurrentUserResponse {
  user: IUser,
  workspace: IWorkspace
}
