import { Injectable } from '@nestjs/common';
import {
  IntegrationProvider,
  IntegrationDefinition,
  LinkDescription,
  OAuthConfig,
  UnfurlPattern,
  UnfurlOpts,
  UnfurlResult,
} from '../../registry/integration-provider.interface';
import { GitLabService } from './gitlab.service';
import { buildGitLabPatterns } from './gitlab-patterns';

const DEFAULT_BASE_URL = 'https://gitlab.com';

@Injectable()
export class GitLabProvider extends IntegrationProvider {
  definition: IntegrationDefinition = {
    type: 'gitlab',
    name: 'GitLab',
    description: 'Link previews for projects, merge requests, issues, and commits',
    icon: 'gitlab',
    capabilities: ['oauth', 'unfurl'],
    oauth: {
      authUrl: 'https://gitlab.com/oauth/authorize',
      tokenUrl: 'https://gitlab.com/oauth/token',
      scopes: ['read_api', 'read_user'],
    },
    unfurlPatterns: buildGitLabPatterns('https://gitlab.com'),
  };

  constructor(private readonly gitlabService: GitLabService) {
    super();
  }

  getOAuthConfig(settings: Record<string, any>): OAuthConfig {
    const baseUrl = this.resolveBaseUrl(settings);
    return {
      authUrl: `${baseUrl}/oauth/authorize`,
      tokenUrl: `${baseUrl}/oauth/token`,
      scopes: ['read_api', 'read_user'],
    };
  }

  getUnfurlPatterns(settings: Record<string, any>): UnfurlPattern[] {
    const baseUrl = this.resolveBaseUrl(settings);
    if (baseUrl === DEFAULT_BASE_URL) return [];
    return buildGitLabPatterns(baseUrl);
  }

  async unfurl(opts: UnfurlOpts): Promise<UnfurlResult> {
    const { match, patternType, accessToken, url } = opts;
    const apiBaseUrl = this.resolveApiBaseUrl(url);

    switch (patternType) {
      case 'gitlab-mr': {
        const projectPath = match[1];
        const iid = parseInt(match[2], 10);
        return this.gitlabService.unfurlMergeRequest(
          accessToken, apiBaseUrl, projectPath, iid, url,
        );
      }

      case 'gitlab-issue': {
        const projectPath = match[1];
        const iid = parseInt(match[2], 10);
        return this.gitlabService.unfurlIssue(
          accessToken, apiBaseUrl, projectPath, iid, url,
        );
      }

      case 'gitlab-project': {
        const projectPath = `${match[1]}/${match[2]}`;
        return this.gitlabService.unfurlProject(
          accessToken, apiBaseUrl, projectPath, url,
        );
      }

      case 'gitlab-commit': {
        const projectPath = match[1];
        const commitSha = match[2];
        return this.gitlabService.unfurlCommit(
          accessToken, apiBaseUrl, projectPath, commitSha, url,
        );
      }

      case 'gitlab-commit-in-mr': {
        const projectPath = match[1];
        const commitSha = match[3];
        return this.gitlabService.unfurlCommit(
          accessToken, apiBaseUrl, projectPath, commitSha, url,
        );
      }

      case 'gitlab-work-item-drawer': {
        const target = this.decodeWorkItemShowParam(url);
        if (!target) {
          throw new Error('Could not decode work item show param');
        }
        return this.gitlabService.unfurlIssue(
          accessToken, apiBaseUrl, target.fullPath, target.iid, url,
        );
      }

      case 'gitlab-issues-list': {
        const projectPath = match[1];
        return this.gitlabService.unfurlIssuesList(
          accessToken, apiBaseUrl, projectPath, url,
        );
      }

      case 'gitlab-merges-list': {
        const projectPath = match[1];
        return this.gitlabService.unfurlMergesList(
          accessToken, apiBaseUrl, projectPath, url,
        );
      }

      default:
        throw new Error(`Unknown GitLab pattern type: ${patternType}`);
    }
  }

  describeLink(
    patternType: string,
    match: RegExpMatchArray,
    url: string,
  ): LinkDescription | null {
    const projectPath = match[1];
    switch (patternType) {
      case 'gitlab-mr':
        return { title: `Merge Request !${match[2]}`, description: projectPath };
      case 'gitlab-issue':
        return { title: `Issue #${match[2]}`, description: projectPath };
      case 'gitlab-work-item-drawer': {
        const target = this.decodeWorkItemShowParam(url);
        return target
          ? { title: `Issue #${target.iid}`, description: target.fullPath }
          : { title: 'Work item', description: projectPath };
      }
      case 'gitlab-commit':
        return { title: `Commit ${match[2].slice(0, 8)}`, description: projectPath };
      case 'gitlab-commit-in-mr':
        return { title: `Commit ${match[3].slice(0, 8)}`, description: projectPath };
      case 'gitlab-issues-list':
        return { title: 'Issues', description: projectPath };
      case 'gitlab-merges-list':
        return { title: 'Merge Requests', description: projectPath };
      case 'gitlab-project':
        return { title: `${match[1]}/${match[2]}` };
      default:
        return null;
    }
  }

  // The work items list opens an item as a drawer and encodes it in the URL
  // as ?show=base64({ iid, full_path, id }). full_path beats the URL path:
  // a drawer opened from a group-level list still names the actual project.
  private decodeWorkItemShowParam(
    url: string,
  ): { fullPath: string; iid: number } | null {
    try {
      const show = new URL(url).searchParams.get('show');
      if (!show) return null;
      const base64 = show.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(
        Buffer.from(base64, 'base64').toString('utf8'),
      );
      const iid = parseInt(payload.iid, 10);
      if (typeof payload.full_path !== 'string' || Number.isNaN(iid)) {
        return null;
      }
      return { fullPath: payload.full_path, iid };
    } catch {
      return null;
    }
  }

  private resolveBaseUrl(settings: Record<string, any>): string {
    // env wins: the OAuth app credentials in env are registered on that instance
    const baseUrl =
      process.env.INTEGRATION_GITLAB_BASE_URL ||
      (settings?.baseUrl as string | undefined);
    return baseUrl ? baseUrl.replace(/\/+$/, '') : DEFAULT_BASE_URL;
  }

  private resolveApiBaseUrl(url: string): string {
    const parsed = new URL(url);
    return `${parsed.origin}/api/v4`;
  }
}
