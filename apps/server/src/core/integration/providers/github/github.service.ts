import { Injectable, Logger } from '@nestjs/common';
import { UnfurlResult } from '../../registry/integration-provider.interface';
import { relativeTime } from '../../utils/relative-time';
import { providerApiFetch } from '../../utils/provider-fetch';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  async unfurlPullRequest(
    accessToken: string,
    apiBaseUrl: string,
    owner: string,
    repo: string,
    number: number,
    url: string,
  ): Promise<UnfurlResult> {
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/repos/${owner}/${repo}/pulls/${number}`,
    );

    const prAuthor = data.user?.login;
    const prDesc = [
      `#${data.number}`,
      relativeTime(data.updated_at ?? data.created_at),
      prAuthor,
    ].filter(Boolean).join(' · ');

    return {
      title: data.title,
      description: prDesc,
      url,
      provider: 'github',
      providerIcon: 'github',
      status: this.formatPrStatus(data),
      statusColor: this.getPrStatusColor(data),
      author: prAuthor,
      authorAvatarUrl: data.user?.avatar_url,
      metadata: {
        type: 'pr',
        number: data.number,
        repo: `${owner}/${repo}`,
        labels: data.labels?.map((l: any) => l.name) ?? [],
        draft: data.draft,
        additions: data.additions,
        deletions: data.deletions,
      },
    };
  }

  async unfurlIssue(
    accessToken: string,
    apiBaseUrl: string,
    owner: string,
    repo: string,
    number: number,
    url: string,
  ): Promise<UnfurlResult> {
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/repos/${owner}/${repo}/issues/${number}`,
    );

    const issueAuthor = data.user?.login;
    const issueDesc = [
      `#${data.number}`,
      relativeTime(data.updated_at ?? data.created_at),
      issueAuthor,
    ].filter(Boolean).join(' · ');

    return {
      title: data.title,
      description: issueDesc,
      url,
      provider: 'github',
      providerIcon: 'github',
      status: data.state,
      statusColor: data.state === 'open' ? 'green' : 'purple',
      author: issueAuthor,
      authorAvatarUrl: data.user?.avatar_url,
      metadata: {
        type: 'issue',
        number: data.number,
        repo: `${owner}/${repo}`,
        labels: data.labels?.map((l: any) => l.name) ?? [],
        assignees: data.assignees?.map((a: any) => a.login) ?? [],
      },
    };
  }

  async unfurlRepo(
    accessToken: string,
    apiBaseUrl: string,
    owner: string,
    repo: string,
    url: string,
  ): Promise<UnfurlResult> {
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/repos/${owner}/${repo}`,
    );

    const visibility = data.private ? 'Private' : 'Public';

    return {
      title: data.full_name,
      description: data.description?.slice(0, 200) ?? undefined,
      url,
      provider: 'github',
      providerIcon: 'github',
      status: visibility,
      statusColor: data.private ? 'gray' : 'green',
      author: data.owner?.login,
      authorAvatarUrl: data.owner?.avatar_url,
      metadata: {
        type: 'repo',
        repo: `${owner}/${repo}`,
        stars: data.stargazers_count,
        forks: data.forks_count,
        language: data.language,
        defaultBranch: data.default_branch,
      },
    };
  }

  async unfurlCommit(
    accessToken: string,
    apiBaseUrl: string,
    owner: string,
    repo: string,
    sha: string,
    url: string,
  ): Promise<UnfurlResult> {
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/repos/${owner}/${repo}/commits/${sha}`,
    );

    const shortSha = data.sha?.slice(0, 7);

    const commitAuthor = data.author?.login ?? data.commit?.author?.name;
    const commitDesc = [
      shortSha,
      relativeTime(data.commit?.author?.date ?? data.commit?.committer?.date),
      commitAuthor,
    ].filter(Boolean).join(' · ');

    return {
      title: data.commit?.message?.split('\n')[0] ?? shortSha,
      description: commitDesc,
      url,
      provider: 'github',
      providerIcon: 'github',
      author: commitAuthor,
      authorAvatarUrl: data.author?.avatar_url,
      metadata: {
        type: 'commit',
        sha: data.sha,
        shortSha,
        repo: `${owner}/${repo}`,
        stats: data.stats,
      },
    };
  }

  unfurlFile(
    owner: string,
    repo: string,
    ref: string,
    path: string,
    startLine: number | undefined,
    endLine: number | undefined,
    url: string,
  ): UnfurlResult {
    const fileName = path.split('/').pop() ?? path;
    const lineRange = startLine
      ? endLine
        ? `L${startLine}-L${endLine}`
        : `L${startLine}`
      : undefined;

    return {
      title: lineRange ? `${fileName}#${lineRange}` : fileName,
      description: `${owner}/${repo} · ${ref.slice(0, 7)}`,
      url,
      provider: 'github',
      providerIcon: 'github',
      metadata: {
        type: 'file',
        repo: `${owner}/${repo}`,
        ref,
        path,
        startLine,
        endLine,
      },
    };
  }

  async unfurlCollectionPage(
    accessToken: string,
    apiBaseUrl: string,
    owner: string,
    repo: string,
    collectionType: string,
    url: string,
  ): Promise<UnfurlResult> {
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/repos/${owner}/${repo}`,
    );

    const labels: Record<string, string> = {
      'pulls-list': 'Pull Requests',
      'issues-list': 'Issues',
      'releases-list': 'Releases',
    };

    return {
      title: `${labels[collectionType] ?? collectionType} · ${data.full_name}`,
      description: `${owner}/${repo}`,
      url,
      provider: 'github',
      providerIcon: 'github',
      author: data.owner?.login,
      authorAvatarUrl: data.owner?.avatar_url,
      metadata: {
        type: collectionType,
        repo: `${owner}/${repo}`,
      },
    };
  }

  private formatPrStatus(pr: any): string {
    if (pr.merged) return 'merged';
    if (pr.draft) return 'draft';
    return pr.state;
  }

  private getPrStatusColor(pr: any): string {
    if (pr.merged) return 'purple';
    if (pr.draft) return 'gray';
    if (pr.state === 'open') return 'green';
    return 'red';
  }

  private async apiGet(
    accessToken: string,
    apiBaseUrl: string,
    path: string,
  ): Promise<any> {
    const response = await providerApiFetch('GitHub', `${apiBaseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Docmost',
      },
    });

    return response.json();
  }
}
