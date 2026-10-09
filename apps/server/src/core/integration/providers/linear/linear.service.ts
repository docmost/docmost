import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import {
  ProviderAccount,
  UnfurlResult,
} from '../../registry/integration-provider.interface';
import { providerApiFetch } from '../../utils/provider-fetch';
import { toProviderAccount } from '../../utils/integration.utils';

const LINEAR_API = 'https://api.linear.app/graphql';

@Injectable()
export class LinearService {
  async getAccount(accessToken: string): Promise<ProviderAccount> {
    const data = await this.graphqlRequest(
      accessToken,
      'query Viewer { viewer { id name displayName } }',
      {},
    );
    const viewer = data?.viewer;
    return toProviderAccount({
      id: viewer?.id,
      displayName: viewer?.name,
      username: viewer?.displayName,
    });
  }

  async unfurlIssue(
    accessToken: string,
    issueIdentifier: string,
    url: string,
  ): Promise<UnfurlResult> {
    const query = `
      query Issue($id: String!) {
        issue(id: $id) {
          title
          identifier
          priority
          priorityLabel
          createdAt
          state {
            name
            color
          }
          assignee {
            name
            avatarUrl
          }
          team {
            name
          }
          labels {
            nodes {
              name
              color
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest(accessToken, query, {
      id: issueIdentifier,
    });

    const issue = data?.issue;
    if (!issue) {
      return {
        title: issueIdentifier,
        url,
        provider: 'linear',
        providerIcon: 'linear',
      };
    }

    const descriptionParts = [
      issue.identifier,
      issue.team?.name,
      issue.assignee?.name ?? 'Unassigned',
      this.formatDate(issue.createdAt),
    ].filter(Boolean);

    return {
      title: issue.title,
      description: descriptionParts.join(' · '),
      url,
      provider: 'linear',
      providerIcon: 'linear',
      status: issue.state?.name,
      statusColor: issue.state?.color,
      author: issue.assignee?.name,
      authorAvatarUrl: issue.assignee?.avatarUrl,
      metadata: {
        type: 'issue',
        identifier: issue.identifier,
        priority: issue.priorityLabel,
        labels:
          issue.labels?.nodes?.map((l: any) => ({
            name: l.name,
            color: l.color,
          })) ?? [],
      },
    };
  }

  async unfurlProject(
    accessToken: string,
    slugId: string,
    teamSlug: string,
    url: string,
  ): Promise<UnfurlResult> {
    const query = `
      query ProjectBySlug($slugId: String!) {
        projects(filter: { slugId: { eq: $slugId } }, first: 1) {
          nodes {
            name
            state
            createdAt
            lead {
              name
              avatarUrl
            }
            teams {
              nodes {
                name
              }
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest(accessToken, query, { slugId });
    const project = data?.projects?.nodes?.[0];

    if (!project) {
      return {
        title: this.formatSlug(slugId),
        description: teamSlug,
        url,
        provider: 'linear',
        providerIcon: 'linear',
        metadata: { type: 'project' },
      };
    }

    const teamName = project.teams?.nodes?.[0]?.name;
    const descriptionParts = [
      'Project',
      this.formatDate(project.createdAt),
      project.lead?.name,
      teamName,
    ].filter(Boolean);

    return {
      title: project.name,
      description: descriptionParts.join(' · '),
      url,
      provider: 'linear',
      providerIcon: 'linear',
      status: this.formatProjectState(project.state),
      statusColor: this.getProjectStatusColor(project.state),
      author: project.lead?.name,
      authorAvatarUrl: project.lead?.avatarUrl,
      metadata: { type: 'project' },
    };
  }

  async unfurlInitiative(
    accessToken: string,
    slugId: string,
    teamSlug: string,
    url: string,
  ): Promise<UnfurlResult> {
    const query = `
      query InitiativeBySlug($slugId: String!) {
        initiatives(filter: { slugId: { eq: $slugId } }, first: 1) {
          nodes {
            name
            description
            status
          }
        }
      }
    `;

    const data = await this.graphqlRequest(accessToken, query, { slugId });
    const initiative = data?.initiatives?.nodes?.[0];

    if (!initiative) {
      return {
        title: this.formatSlug(slugId),
        description: teamSlug,
        url,
        provider: 'linear',
        providerIcon: 'linear',
        metadata: { type: 'initiative' },
      };
    }

    return {
      title: initiative.name,
      description: initiative.description?.slice(0, 200) ?? undefined,
      url,
      provider: 'linear',
      providerIcon: 'linear',
      status: initiative.status,
      metadata: { type: 'initiative' },
    };
  }

  unfurlView(
    teamSlug: string,
    viewId: string,
    url: string,
  ): UnfurlResult {
    return {
      title: `View · ${this.formatSlug(viewId)}`,
      description: teamSlug,
      url,
      provider: 'linear',
      providerIcon: 'linear',
      metadata: { type: 'view' },
    };
  }

  private formatProjectState(state: string): string {
    return state.charAt(0).toUpperCase() + state.slice(1);
  }

  private formatDate(iso: string): string {
    return format(new Date(iso), 'MMM d');
  }

  private formatSlug(slug: string): string {
    return slug
      .replace(/-[a-f0-9]+$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private getProjectStatusColor(state: string): string {
    switch (state) {
      case 'completed':
        return 'green';
      case 'started':
        return 'yellow';
      case 'planned':
        return 'blue';
      case 'paused':
      case 'canceled':
        return 'gray';
      default:
        return 'gray';
    }
  }

  private async graphqlRequest(
    accessToken: string,
    query: string,
    variables: Record<string, any>,
  ): Promise<any> {
    const response = await providerApiFetch('Linear', LINEAR_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const json = await response.json();
    return json.data;
  }
}
