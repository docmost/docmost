import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Json = JsonValue;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Attachments {
  createdAt: Generated<Timestamp>;
  creatorId: string;
  deletedAt: Timestamp | null;
  fileExt: string;
  fileName: string;
  filePath: string;
  fileSize: Int8 | null;
  id: Generated<string>;
  mimeType: string | null;
  pageId: string | null;
  spaceId: string | null;
  type: string | null;
  updatedAt: Generated<Timestamp>;
  workspaceId: string | null;
}

export interface Comments {
  content: Json | null;
  createdAt: Generated<Timestamp>;
  creatorId: string | null;
  deletedAt: Timestamp | null;
  editedAt: Timestamp | null;
  id: Generated<string>;
  pageId: string;
  parentCommentId: string | null;
  selection: string | null;
  type: string | null;
  workspaceId: string;
}

export interface Groups {
  createdAt: Generated<Timestamp>;
  creatorId: string | null;
  description: string | null;
  id: Generated<string>;
  isDefault: boolean;
  name: string;
  updatedAt: Generated<Timestamp>;
  workspaceId: string;
}

export interface GroupUsers {
  createdAt: Generated<Timestamp>;
  groupId: string;
  id: Generated<string>;
  updatedAt: Generated<Timestamp>;
  userId: string;
}

export interface PageHistory {
  content: Json | null;
  coverPhoto: string | null;
  createdAt: Generated<Timestamp>;
  icon: string | null;
  id: Generated<string>;
  lastUpdatedById: string | null;
  pageId: string;
  slug: string | null;
  spaceId: string;
  title: string | null;
  updatedAt: Generated<Timestamp>;
  version: number;
  workspaceId: string;
}

export interface PageOrdering {
  childrenIds: string[];
  createdAt: Generated<Timestamp>;
  deletedAt: Timestamp | null;
  entityId: string;
  entityType: string;
  id: Generated<string>;
  spaceId: string;
  updatedAt: Generated<Timestamp>;
  workspaceId: string;
}

export interface Pages {
  content: Json | null;
  coverPhoto: string | null;
  createdAt: Generated<Timestamp>;
  creatorId: string | null;
  deletedAt: Timestamp | null;
  deletedById: string | null;
  editor: string | null;
  html: string | null;
  icon: string | null;
  id: Generated<string>;
  isLocked: Generated<boolean>;
  key: string | null;
  lastUpdatedById: string | null;
  parentPageId: string | null;
  publishedAt: Timestamp | null;
  slug: string | null;
  spaceId: string;
  status: string | null;
  textContent: string | null;
  title: string | null;
  tsv: string | null;
  updatedAt: Generated<Timestamp>;
  workspaceId: string;
  ydoc: Buffer | null;
}

export interface SpaceMembers {
  createdAt: Generated<Timestamp>;
  creatorId: string | null;
  groupId: string | null;
  id: Generated<string>;
  role: string;
  spaceId: string;
  updatedAt: Generated<Timestamp>;
  userId: string | null;
}

export interface Spaces {
  createdAt: Generated<Timestamp>;
  creatorId: string | null;
  defaultRole: Generated<string>;
  deletedAt: Timestamp | null;
  description: string | null;
  icon: string | null;
  id: Generated<string>;
  name: string | null;
  slug: string | null;
  updatedAt: Generated<Timestamp>;
  visibility: Generated<string>;
  workspaceId: string;
}

export interface Users {
  avatarUrl: string | null;
  createdAt: Generated<Timestamp>;
  email: string;
  emailVerifiedAt: Timestamp | null;
  id: Generated<string>;
  lastActiveAt: Timestamp | null;
  lastLoginAt: Timestamp | null;
  locale: string | null;
  name: string | null;
  password: string;
  role: string | null;
  settings: Json | null;
  status: string | null;
  timezone: string | null;
  updatedAt: Generated<Timestamp>;
  workspaceId: string | null;
}

export interface WorkspaceInvitations {
  createdAt: Generated<Timestamp>;
  email: string;
  id: Generated<string>;
  invitedById: string | null;
  role: string;
  status: string | null;
  updatedAt: Generated<Timestamp>;
  workspaceId: string;
}

export interface Workspaces {
  createdAt: Generated<Timestamp>;
  customDomain: string | null;
  defaultRole: Generated<string>;
  defaultSpaceId: string | null;
  deletedAt: Timestamp | null;
  description: string | null;
  enableInvite: Generated<boolean>;
  hostname: string | null;
  id: Generated<string>;
  inviteCode: Generated<string | null>;
  logo: string | null;
  name: string | null;
  settings: Json | null;
  updatedAt: Generated<Timestamp>;
}

export interface DB {
  attachments: Attachments;
  comments: Comments;
  groups: Groups;
  groupUsers: GroupUsers;
  pageHistory: PageHistory;
  pageOrdering: PageOrdering;
  pages: Pages;
  spaceMembers: SpaceMembers;
  spaces: Spaces;
  users: Users;
  workspaceInvitations: WorkspaceInvitations;
  workspaces: Workspaces;
}
