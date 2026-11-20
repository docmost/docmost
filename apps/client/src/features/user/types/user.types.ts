import { IWorkspace } from "@/features/workspace/types/workspace.types";

export interface IUser {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date;
  avatarUrl: string;
  timezone: string;
  settings: IUserSettings;
  invitedById: string;
  lastLoginAt?: string;
  lastActiveAt: Date;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  workspaceId: string;
  deactivatedAt: Date;
  deletedAt: Date;
  fullPageWidth: boolean; // used for update
  pageEditMode: string; // used for update
  editorToolbar: boolean; // used for update
  notificationPageUpdates: boolean; // used for update
  notificationPageUserMention: boolean; // used for update
  notificationCommentUserMention: boolean; // used for update
  notificationCommentCreated: boolean; // used for update
  notificationCommentResolved: boolean; // used for update
  hasGeneratedPassword?: boolean;
}

export interface ICurrentUser {
  user: IUser;
  workspace: IWorkspace;
}

export interface IUserSettings {
  preferences: {
    fullPageWidth: boolean;
    pageEditMode: string;
    editorToolbar: boolean;
  };
  notifications?: {
    "page.updated"?: boolean;
    "page.userMention"?: boolean;
    "comment.userMention"?: boolean;
    "comment.created"?: boolean;
    "comment.resolved"?: boolean;
  };
}

export enum PageEditMode {
  Read = "read",
  Edit = "edit",
}

export interface IUserProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  email: string | null;
  role: string;
  deactivatedAt: Date | null;
  deletedAt: Date | null;
}

export interface IUserProfileSpace {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}

export interface IUserRecentPage {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  isBase: boolean;
  spaceId: string;
  space: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  };
  activity: "created" | "edited";
  activityAt: Date;
}
