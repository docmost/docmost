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
import { GitHubService } from './github.service';
import { buildGitHubPatterns } from './github-patterns';

const DEFAULT_BASE_URL = 'https://github.com';

@Injectable()
export class GitHubProvider extends IntegrationProvider {
  definition: IntegrationDefinition = {
    type: 'github',
    name: 'GitHub',
    description: 'Link previews for repos, pull requests, issues, commits, and files',
    icon: 'github',
    capabilities: ['oauth', 'unfurl'],
    oauth: {
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scopes: ['repo', 'read:user'],
    },
    unfurlPatterns: buildGitHubPatterns('https://github.com'),
  };

  constructor(private readonly githubService: GitHubService) {
    super();
  }

  getOAuthConfig(settings: Record<string, any>): OAuthConfig {
    const baseUrl = this.resolveBaseUrl();
    return {
      authUrl: `${baseUrl}/login/oauth/authorize`,
      tokenUrl: `${baseUrl}/login/oauth/access_token`,
      scopes: ['repo', 'read:user'],
    };
  }

  getUnfurlPatterns(settings: Record<string, any>): UnfurlPattern[] {
    const baseUrl = this.resolveBaseUrl();
    if (baseUrl === DEFAULT_BASE_URL) return [];
    return buildGitHubPatterns(baseUrl);
  }

  async unfurl(opts: UnfurlOpts): Promise<UnfurlResult> {
    const { match, patternType, accessToken, url } = opts;
    const apiBaseUrl = this.resolveApiBaseUrl(url);
    const owner = match[1];
    const repo = match[2];

    switch (patternType) {
      case 'github-pr': {
        const number = parseInt(match[3], 10);
        return this.githubService.unfurlPullRequest(
          accessToken, apiBaseUrl, owner, repo, number, url,
        );
      }

      case 'github-issue': {
        const number = parseInt(match[3], 10);
        return this.githubService.unfurlIssue(
          accessToken, apiBaseUrl, owner, repo, number, url,
        );
      }

      case 'github-repo':
        return this.githubService.unfurlRepo(
          accessToken, apiBaseUrl, owner, repo, url,
        );

      case 'github-commit': {
        const sha = match[3];
        return this.githubService.unfurlCommit(
          accessToken, apiBaseUrl, owner, repo, sha, url,
        );
      }

      case 'github-pr-commit': {
        const sha = match[4];
        return this.githubService.unfurlCommit(
          accessToken, apiBaseUrl, owner, repo, sha, url,
        );
      }

      case 'github-file': {
        const ref = match[3];
        const path = match[4];
        const startLine = match[5] ? parseInt(match[5], 10) : undefined;
        const endLine = match[6] ? parseInt(match[6], 10) : undefined;
        return this.githubService.unfurlFile(
          owner, repo, ref, path, startLine, endLine, url,
        );
      }

      case 'github-pulls-list':
      case 'github-issues-list':
      case 'github-releases-list':
        return this.githubService.unfurlCollectionPage(
          accessToken, apiBaseUrl, owner, repo, patternType.replace('github-', ''), url,
        );

      default:
        throw new Error(`Unknown GitHub pattern type: ${patternType}`);
    }
  }

  describeLink(
    patternType: string,
    match: RegExpMatchArray,
  ): LinkDescription | null {
    const repo = `${match[1]}/${match[2]}`;
    switch (patternType) {
      case 'github-pr':
        return { title: `Pull Request #${match[3]}`, description: repo };
      case 'github-pr-commit':
        return { title: `Commit ${match[4].slice(0, 7)}`, description: repo };
      case 'github-issue':
        return { title: `Issue #${match[3]}`, description: repo };
      case 'github-commit':
        return { title: `Commit ${match[3].slice(0, 7)}`, description: repo };
      case 'github-file':
        return { title: match[4], description: repo };
      case 'github-pulls-list':
        return { title: 'Pull Requests', description: repo };
      case 'github-issues-list':
        return { title: 'Issues', description: repo };
      case 'github-releases-list':
        return { title: 'Releases', description: repo };
      case 'github-repo':
        return { title: repo };
      default:
        return null;
    }
  }

  private resolveBaseUrl(): string {
    const baseUrl = process.env.INTEGRATION_GITHUB_BASE_URL;
    return baseUrl ? baseUrl.replace(/\/+$/, '') : DEFAULT_BASE_URL;
  }

  private resolveApiBaseUrl(url: string): string {
    const parsed = new URL(url);
    if (parsed.hostname === 'github.com') {
      return 'https://api.github.com';
    }
    return `${parsed.origin}/api/v3`;
  }
}
