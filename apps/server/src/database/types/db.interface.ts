import {
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
  Pages,
  Shares,
  SpaceMembers,
  Spaces,
  UserMfa,
  Users,
  UserTokens,
  WorkspaceInvitations,
  Workspaces,
} from '@docmost/db/types/db';
import { Embeddings } from '@docmost/db/types/embeddings.types';

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
  pageEmbeddings: Embeddings;
  pageHistory: PageHistory;
  pages: Pages;
  shares: Shares;
  spaceMembers: SpaceMembers;
  spaces: Spaces;
  userMfa: UserMfa;
  users: Users;
  userTokens: UserTokens;
  workspaceInvitations: WorkspaceInvitations;
  workspaces: Workspaces;
}
