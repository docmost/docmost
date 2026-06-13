import { Injectable, Logger } from '@nestjs/common';

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

export interface LinearViewer {
  id: string;
  name: string;
}

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number;
  priorityLabel: string;
  description?: string | null;
  updatedAt: string;
  state?: { name: string; type: string; color: string } | null;
  assignee?: { name: string; displayName: string; avatarUrl?: string } | null;
  team?: LinearTeam | null;
}

const ISSUE_FIELDS = `
  id
  identifier
  title
  url
  priority
  priorityLabel
  description
  updatedAt
  state { name type color }
  assignee { name displayName avatarUrl }
  team { id key name }
`;

// Linear GraphQL data queries. Token lifecycle is handled by Oauth2Service;
// these methods take an already-valid access token.
@Injectable()
export class LinearApiService {
  private readonly logger = new Logger(LinearApiService.name);

  private async graphql<T>(
    accessToken: string,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    const json = (await response.json()) as { data?: T; errors?: unknown };
    if (!response.ok || json.errors) {
      this.logger.error(`Linear GraphQL error: ${JSON.stringify(json.errors)}`);
      throw new Error('Linear API request failed');
    }
    return json.data as T;
  }

  async getViewer(accessToken: string): Promise<LinearViewer> {
    const data = await this.graphql<{ viewer: LinearViewer }>(
      accessToken,
      `query { viewer { id name } }`,
    );
    return data.viewer;
  }

  async searchIssues(
    accessToken: string,
    term: string,
    first = 10,
  ): Promise<LinearIssue[]> {
    const data = await this.graphql<{ searchIssues: { nodes: LinearIssue[] } }>(
      accessToken,
      `query SearchIssues($term: String!, $first: Int) {
        searchIssues(term: $term, first: $first) {
          nodes { ${ISSUE_FIELDS} }
        }
      }`,
      { term, first },
    );
    return data.searchIssues?.nodes ?? [];
  }

  async getIssue(
    accessToken: string,
    issueId: string,
  ): Promise<LinearIssue | null> {
    const data = await this.graphql<{ issue: LinearIssue | null }>(
      accessToken,
      `query GetIssue($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} } }`,
      { id: issueId },
    );
    return data.issue ?? null;
  }

  async createIssue(
    accessToken: string,
    input: { teamId: string; title: string; description?: string },
  ): Promise<LinearIssue | null> {
    const data = await this.graphql<{
      issueCreate: { success: boolean; issue: LinearIssue | null };
    }>(
      accessToken,
      `mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) { success issue { ${ISSUE_FIELDS} } }
      }`,
      { input },
    );
    return data.issueCreate?.issue ?? null;
  }

  async getTeams(accessToken: string): Promise<LinearTeam[]> {
    const data = await this.graphql<{ teams: { nodes: LinearTeam[] } }>(
      accessToken,
      // 250 is Linear's max page size; far beyond any realistic team count
      `query { teams(first: 250) { nodes { id key name } } }`,
    );
    return data.teams?.nodes ?? [];
  }
}
