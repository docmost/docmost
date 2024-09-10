import { IWorkspace } from "@/features/workspace/types/workspace.types";

type IUserPreferences = {
  fullPageWidth: boolean;
  language: string;
};

export interface IUser extends IUserPreferences {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date;
  avatarUrl: string;
  timezone: string;
  settings: IUserSettings;
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

export interface IUserSettings {
  preferences: IUserPreferences
}
