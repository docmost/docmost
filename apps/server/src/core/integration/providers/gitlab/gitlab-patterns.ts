import { UnfurlPattern } from '../../registry/integration-provider.interface';

function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildGitLabPatterns(baseUrl: string): UnfurlPattern[] {
  const escaped = escapeForRegex(baseUrl);
  return [
    {
      regex: new RegExp(
        `^${escaped}\\/(.+)\\/-\\/merge_requests\\/(\\d+)\\/diffs\\?.*commit_id=([a-f0-9]+)`,
      ),
      type: 'gitlab-commit-in-mr',
    },
    {
      regex: new RegExp(
        `^${escaped}\\/(.+)\\/-\\/merge_requests\\/(\\d+)`,
      ),
      type: 'gitlab-mr',
    },
    {
      regex: new RegExp(
        `^${escaped}\\/(.+)\\/-\\/issues\\/(\\d+)`,
      ),
      type: 'gitlab-issue',
    },
    // Issues renamed to work items; same iid, resolved via the issues API.
    {
      regex: new RegExp(
        `^${escaped}\\/(.+)\\/-\\/work_items\\/(\\d+)`,
      ),
      type: 'gitlab-issue',
    },
    // Work item opened as a drawer over the list; the target is base64 JSON
    // in the show param, decoded by the provider.
    {
      regex: new RegExp(
        `^${escaped}\\/(.+)\\/-\\/work_items\\/?\\?(?:.*&)?show=`,
      ),
      type: 'gitlab-work-item-drawer',
    },
    {
      regex: new RegExp(
        `^${escaped}\\/(.+)\\/-\\/commits?\\/([a-f0-9]+)`,
      ),
      type: 'gitlab-commit',
    },
    {
      regex: new RegExp(
        `^${escaped}\\/(.+)\\/-\\/issues(?:\\/)?(?:\\?.*)?$`,
      ),
      type: 'gitlab-issues-list',
    },
    {
      regex: new RegExp(
        `^${escaped}\\/(.+)\\/-\\/merge_requests(?:\\/)?(?:\\?.*)?$`,
      ),
      type: 'gitlab-merges-list',
    },
    {
      regex: new RegExp(
        `^${escaped}\\/([a-zA-Z0-9\\-_.]+)\\/([a-zA-Z0-9\\-_]+)\\/?$`,
      ),
      type: 'gitlab-project',
    },
  ];
}
