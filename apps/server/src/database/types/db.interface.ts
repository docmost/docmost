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
  PageHistory,
  PagePermissions,
  Pages,
  Shares,
  SpaceMembers,
  Spaces,
  UserMfa,
  Users,
  UserSharedPages,
  UserTokens,
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
  pageEmbeddings: PageEmbeddings;
  pagePermissions: PagePermissions;
  pageHistory: PageHistory;
  pages: Pages;
  shares: Shares;
  spaceMembers: SpaceMembers;
  spaces: Spaces;
  userMfa: UserMfa;
  users: Users;
  userSharedPages: UserSharedPages;
  userTokens: UserTokens;
  workspaceInvitations: WorkspaceInvitations;
  workspaces: Workspaces;
  apiKeys: ApiKeys;
}
