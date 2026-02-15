import {
  ApiKeys,
  Attachments,
  AuthAccounts,
  AuthProviders,
  Backlinks,
  Billing,
  Comments,
  FileTasks,
  Groups,
  GroupUsers,
  Notifications,
  PageAccess,
  PageHistory,
  PagePermissions,
  Pages,
  Shares,
  SpaceMembers,
  Spaces,
  UserMfa,
  Users,
  UserTokens,
  Watchers,
  WorkspaceInvitations,
  Workspaces,
} from '@docmost/db/types/db';
import { PageEmbeddings } from '@docmost/db/types/embeddings.types';

export interface DbInterface {
  attachments: Attachments;
  authAccounts: AuthAccounts;
  authProviders: AuthProviders;
  backlinks: Backlinks;
  billing: Billing;
  comments: Comments;
  fileTasks: FileTasks;
  groups: Groups;
  groupUsers: GroupUsers;
  notifications: Notifications;
  pageAccess: PageAccess;
  pageEmbeddings: PageEmbeddings;
  pageHistory: PageHistory;
  pagePermissions: PagePermissions;
  pages: Pages;
  shares: Shares;
  spaceMembers: SpaceMembers;
  spaces: Spaces;
  userMfa: UserMfa;
  users: Users;
  userTokens: UserTokens;
  watchers: Watchers;
  workspaceInvitations: WorkspaceInvitations;
  workspaces: Workspaces;
  apiKeys: ApiKeys;
}
