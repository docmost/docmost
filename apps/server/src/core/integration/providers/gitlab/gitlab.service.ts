import { Injectable, Logger } from '@nestjs/common';
import { UnfurlResult } from '../../registry/integration-provider.interface';
import { relativeTime } from '../../utils/relative-time';
import { providerApiFetch } from '../../utils/provider-fetch';

@Injectable()
export class GitLabService {
  private readonly logger = new Logger(GitLabService.name);

  async unfurlMergeRequest(
    accessToken: string,
    apiBaseUrl: string,
    projectPath: string,
    iid: number,
    url: string,
  ): Promise<UnfurlResult> {
    const encodedProject = encodeURIComponent(projectPath);
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/projects/${encodedProject}/merge_requests/${iid}`,
    );

    const authorName = data.author?.name ?? data.author?.username;
    const desc = [
      `!${data.iid}`,
      relativeTime(data.updated_at ?? data.created_at),
      authorName,
    ].filter(Boolean).join(' · ');

    return {
      title: data.title,
      description: desc,
      url,
      provider: 'gitlab',
      providerIcon: 'gitlab',
      status: this.formatMrStatus(data),
      statusColor: this.getMrStatusColor(data),
      author: authorName,
      authorAvatarUrl: data.author?.avatar_url,
      metadata: {
        type: 'mr',
        iid: data.iid,
        project: projectPath,
        labels: data.labels ?? [],
        draft: data.draft ?? data.work_in_progress,
      },
    };
  }

  async unfurlIssue(
    accessToken: string,
    apiBaseUrl: string,
    projectPath: string,
    iid: number,
    url: string,
  ): Promise<UnfurlResult> {
    const encodedProject = encodeURIComponent(projectPath);
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/projects/${encodedProject}/issues/${iid}`,
    );

    const issueAuthor = data.author?.name ?? data.author?.username;
    const issueDesc = [
      `#${data.iid}`,
      relativeTime(data.updated_at ?? data.created_at),
      issueAuthor,
    ].filter(Boolean).join(' · ');

    return {
      title: data.title,
      description: issueDesc,
      url,
      provider: 'gitlab',
      providerIcon: 'gitlab',
      status: data.state,
      statusColor: data.state === 'opened' ? 'green' : 'blue',
      author: issueAuthor,
      authorAvatarUrl: data.author?.avatar_url,
      metadata: {
        type: 'issue',
        iid: data.iid,
        project: projectPath,
        labels: data.labels ?? [],
        assignees:
          data.assignees?.map((a: any) => a.name ?? a.username) ?? [],
      },
    };
  }

  async unfurlProject(
    accessToken: string,
    apiBaseUrl: string,
    projectPath: string,
    url: string,
  ): Promise<UnfurlResult> {
    const encodedProject = encodeURIComponent(projectPath);
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/projects/${encodedProject}`,
    );

    const visibility = data.visibility === 'public' ? 'Public' : data.visibility === 'internal' ? 'Internal' : 'Private';

    return {
      title: data.name,
      description: data.description?.slice(0, 200) ?? undefined,
      url,
      provider: 'gitlab',
      providerIcon: 'gitlab',
      status: visibility,
      statusColor: data.visibility === 'public' ? 'green' : 'gray',
      author: data.namespace?.name,
      authorAvatarUrl: data.avatar_url ?? data.namespace?.avatar_url,
      metadata: {
        type: 'project',
        project: projectPath,
        stars: data.star_count,
        forks: data.forks_count,
        defaultBranch: data.default_branch,
      },
    };
  }

  async unfurlCommit(
    accessToken: string,
    apiBaseUrl: string,
    projectPath: string,
    commitSha: string,
    url: string,
  ): Promise<UnfurlResult> {
    const encodedProject = encodeURIComponent(projectPath);
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/projects/${encodedProject}/repository/commits/${commitSha}`,
    );

    const shortSha = data.short_id ?? data.id?.slice(0, 8);

    const commitDesc = [
      shortSha,
      relativeTime(data.committed_date ?? data.created_at),
      data.author_name,
    ].filter(Boolean).join(' · ');

    return {
      title: data.title ?? data.message?.split('\n')[0],
      description: commitDesc,
      url,
      provider: 'gitlab',
      providerIcon: 'gitlab',
      author: data.author_name,
      authorAvatarUrl: undefined,
      metadata: {
        type: 'commit',
        sha: data.id,
        shortSha,
        project: projectPath,
        stats: data.stats,
      },
    };
  }

  async unfurlIssuesList(
    accessToken: string,
    apiBaseUrl: string,
    projectPath: string,
    url: string,
  ): Promise<UnfurlResult> {
    const encodedProject = encodeURIComponent(projectPath);
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/projects/${encodedProject}?statistics=false`,
    );

    return {
      title: `Issues · ${data.name}`,
      description: projectPath,
      url,
      provider: 'gitlab',
      providerIcon: 'gitlab',
      author: data.namespace?.name,
      authorAvatarUrl: data.avatar_url ?? data.namespace?.avatar_url,
      metadata: {
        type: 'issues-list',
        project: projectPath,
        openIssuesCount: data.open_issues_count,
      },
    };
  }

  async unfurlMergesList(
    accessToken: string,
    apiBaseUrl: string,
    projectPath: string,
    url: string,
  ): Promise<UnfurlResult> {
    const encodedProject = encodeURIComponent(projectPath);
    const data = await this.apiGet(
      accessToken,
      apiBaseUrl,
      `/projects/${encodedProject}?statistics=false`,
    );

    return {
      title: `Merge Requests · ${data.name}`,
      description: projectPath,
      url,
      provider: 'gitlab',
      providerIcon: 'gitlab',
      author: data.namespace?.name,
      authorAvatarUrl: data.avatar_url ?? data.namespace?.avatar_url,
      metadata: {
        type: 'merges-list',
        project: projectPath,
      },
    };
  }

  private formatMrStatus(mr: any): string {
    if (mr.state === 'merged') return 'merged';
    if (mr.draft || mr.work_in_progress) return 'draft';
    return mr.state;
  }

  private getMrStatusColor(mr: any): string {
    if (mr.state === 'merged') return 'purple';
    if (mr.draft || mr.work_in_progress) return 'gray';
    if (mr.state === 'opened') return 'green';
    if (mr.state === 'closed') return 'red';
    return 'gray';
  }

  private async apiGet(
    accessToken: string,
    apiBaseUrl: string,
    path: string,
  ): Promise<any> {
    const response = await providerApiFetch('GitLab', `${apiBaseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    return response.json();
  }
}
