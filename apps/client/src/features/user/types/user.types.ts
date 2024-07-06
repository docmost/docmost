import { IWorkspace } from "@/features/workspace/types/workspace.types";

export interface IUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  timezone: string;
  role: string;
  workspaceId: string;

  // These are only in the frontend and not returned from the backend
  fullPageWidth: boolean;
  settings: IUserSettings;
}

export interface ICurrentUser {
  user: IUser;
  workspace: IWorkspace;
}

export interface IUserSettings {
  preferences: {
    fullPageWidth: boolean;
  };
}
