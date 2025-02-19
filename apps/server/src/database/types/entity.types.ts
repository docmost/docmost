import { Insertable, Selectable, Updateable } from 'kysely';
import {
  Attachments,
  Comments,
  Groups,
  Pages,
  Spaces,
  Users,
  Workspaces,
  PageHistory as History,
  GroupUsers,
  SpaceMembers,
  WorkspaceInvitations,
  UserTokens,
  Backlinks,
} from './db';

// Workspace
export type Workspace = Selectable<Workspaces>;
export type InsertableWorkspace = Insertable<Workspaces>;
export type UpdatableWorkspace = Updateable<Omit<Workspaces, 'id'>>;

// WorkspaceInvitation
export type WorkspaceInvitation = Selectable<WorkspaceInvitations>;
export type InsertableWorkspaceInvitation = Insertable<WorkspaceInvitations>;
export type UpdatableWorkspaceInvitation = Updateable<
  Omit<WorkspaceInvitations, 'id'>
>;

// User
export type User = Selectable<Users>;
export type InsertableUser = Insertable<Users>;
export type UpdatableUser = Updateable<Omit<Users, 'id'>>;

// Space
export type Space = Selectable<Spaces>;
export type InsertableSpace = Insertable<Spaces>;
export type UpdatableSpace = Updateable<Omit<Spaces, 'id'>>;

// SpaceMember
export type SpaceMember = Selectable<SpaceMembers>;
export type InsertableSpaceMember = Insertable<SpaceMembers>;
export type UpdatableSpaceMember = Updateable<Omit<SpaceMembers, 'id'>>;

// Group
export type ExtendedGroup = Groups & { memberCount: number };

export type Group = Selectable<Groups>;
export type InsertableGroup = Insertable<Groups>;
export type UpdatableGroup = Updateable<Omit<Groups, 'id'>>;

// GroupUser
export type GroupUser = Selectable<GroupUsers>;
export type InsertableGroupUser = Insertable<GroupUsers>;
export type UpdatableGroupUser = Updateable<Omit<GroupUsers, 'id'>>;

// Page
export type Page = Selectable<Pages>;
export type InsertablePage = Insertable<Pages>;
export type UpdatablePage = Updateable<Omit<Pages, 'id'>>;

// PageHistory
export type PageHistory = Selectable<History>;
export type InsertablePageHistory = Insertable<History>;
export type UpdatablePageHistory = Updateable<Omit<History, 'id'>>;

// Comment
export type Comment = Selectable<Comments>;
export type InsertableComment = Insertable<Comments>;
export type UpdatableComment = Updateable<Omit<Comments, 'id'>>;

// Attachment
export type Attachment = Selectable<Attachments>;
export type InsertableAttachment = Insertable<Attachments>;
export type UpdatableAttachment = Updateable<Omit<Attachments, 'id'>>;

// User Token
export type UserToken = Selectable<UserTokens>;
export type InsertableUserToken = Insertable<UserTokens>;
export type UpdatableUserToken = Updateable<Omit<UserTokens, 'id'>>;

// Backlink
export type Backlink = Selectable<Backlinks>;
export type InsertableBacklink = Insertable<Backlink>;
export type UpdatableBacklink = Updateable<Omit<Backlink, 'id'>>;
