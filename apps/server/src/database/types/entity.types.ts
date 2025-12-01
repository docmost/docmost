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
  Billing as BillingSubscription,
  AuthProviders,
  AuthAccounts,
  Shares,
  FileTasks,
  UserMfa as _UserMFA,
  ApiKeys,
} from './db';
import { PageEmbeddings } from '@docmost/db/types/embeddings.types';

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

// Billing
export type Billing = Selectable<BillingSubscription>;
export type InsertableBilling = Insertable<BillingSubscription>;
export type UpdatableBilling = Updateable<Omit<BillingSubscription, 'id'>>;

// Auth Provider
export type AuthProvider = Selectable<AuthProviders>;
export type InsertableAuthProvider = Insertable<AuthProviders>;
export type UpdatableAuthProvider = Updateable<Omit<AuthProviders, 'id'>>;

// Auth Account
export type AuthAccount = Selectable<AuthAccounts>;
export type InsertableAuthAccount = Insertable<AuthAccounts>;
export type UpdatableAuthAccount = Updateable<Omit<AuthAccounts, 'id'>>;

// Share
export type Share = Selectable<Shares>;
export type InsertableShare = Insertable<Shares>;
export type UpdatableShare = Updateable<Omit<Shares, 'id'>>;

// File Task
export type FileTask = Selectable<FileTasks>;
export type InsertableFileTask = Insertable<FileTasks>;
export type UpdatableFileTask = Updateable<Omit<FileTasks, 'id'>>;

// UserMFA
export type UserMFA = Selectable<_UserMFA>;
export type InsertableUserMFA = Insertable<_UserMFA>;
export type UpdatableUserMFA = Updateable<Omit<_UserMFA, 'id'>>;

// Api Keys
export type ApiKey = Selectable<ApiKeys>;
export type InsertableApiKey = Insertable<ApiKeys>;
export type UpdatableApiKey = Updateable<Omit<ApiKeys, 'id'>>;

// Page Embedding
export type PageEmbedding = Selectable<PageEmbeddings>;
export type InsertablePageEmbedding = Insertable<PageEmbeddings>;
export type UpdatablePageEmbedding = Updateable<Omit<PageEmbeddings, 'id'>>;
