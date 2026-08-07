export interface ILinearIssueState {
  name: string;
  type: string;
  color: string;
}

export interface ILinearIssueAssignee {
  name: string;
  displayName: string;
  avatarUrl?: string;
}

export interface ILinearTeam {
  id: string;
  key: string;
  name: string;
}

export interface ILinearIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number;
  priorityLabel: string;
  description?: string | null;
  updatedAt: string;
  state?: ILinearIssueState | null;
  assignee?: ILinearIssueAssignee | null;
  team?: ILinearTeam | null;
}

export interface ILinearIssueSearchResult {
  connected: boolean;
  issues: ILinearIssue[];
}

export interface ILinearIssueResult {
  connected: boolean;
  issue: ILinearIssue | null;
}

export interface ILinearTeamsResult {
  connected: boolean;
  teams: ILinearTeam[];
}
