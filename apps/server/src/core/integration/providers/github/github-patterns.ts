import { UnfurlPattern } from '../../registry/integration-provider.interface';
import { CANONICAL_PATH } from '../../utils/canonical-path';

function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildGitHubPatterns(baseUrl: string): UnfurlPattern[] {
  const prefix = `^${escapeForRegex(baseUrl)}${CANONICAL_PATH}`;
  return [
    // Commit within a PR: /:owner/:repo/pull/:num/commits/:sha
    {
      regex: new RegExp(
        `${prefix}\\/([a-zA-Z0-9\\-_.]+)\\/([a-zA-Z0-9\\-_.]+)\\/pull\\/(\\d+)\\/commits\\/([a-f0-9]+)`,
      ),
      type: 'github-pr-commit',
    },
    // PR sub-pages: /:owner/:repo/pull/:num(/checks|/commits|/files)?
    {
      regex: new RegExp(`${prefix}\\/([a-zA-Z0-9\\-_.]+)\\/([a-zA-Z0-9\\-_.]+)\\/pull\\/(\\d+)`),
      type: 'github-pr',
    },
    // Single issue: /:owner/:repo/issues/:num
    {
      regex: new RegExp(
        `${prefix}\\/([a-zA-Z0-9\\-_.]+)\\/([a-zA-Z0-9\\-_.]+)\\/issues\\/(\\d+)`,
      ),
      type: 'github-issue',
    },
    // Commit: /:owner/:repo/commit(s)/:sha
    {
      regex: new RegExp(
        `${prefix}\\/([a-zA-Z0-9\\-_.]+)\\/([a-zA-Z0-9\\-_.]+)\\/commits?\\/([a-f0-9]+)`,
      ),
      type: 'github-commit',
    },
    // File/blob: /:owner/:repo/blob/:ref/:path(#L:start(-L:end))?
    {
      regex: new RegExp(
        `${prefix}\\/([a-zA-Z0-9\\-_.]+)\\/([a-zA-Z0-9\\-_.]+)\\/blob\\/([^\\/]+)\\/(.+?)(?:#L(\\d+)(?:-L(\\d+))?)?$`,
      ),
      type: 'github-file',
    },
    // Pulls list: /:owner/:repo/pulls
    {
      regex: new RegExp(
        `${prefix}\\/([a-zA-Z0-9\\-_.]+)\\/([a-zA-Z0-9\\-_.]+)\\/pulls(?:[\\/?].*)?$`,
      ),
      type: 'github-pulls-list',
    },
    // Issues list: /:owner/:repo/issues(/created_by/...|/assigned/...)?
    {
      regex: new RegExp(
        `${prefix}\\/([a-zA-Z0-9\\-_.]+)\\/([a-zA-Z0-9\\-_.]+)\\/issues(?:\\/(?:created_by|assigned)\\/[\\w.\\/-]+)?\\/?(?:\\?.*)?$`,
      ),
      type: 'github-issues-list',
    },
    // Releases: /:owner/:repo/releases
    {
      regex: new RegExp(
        `${prefix}\\/([a-zA-Z0-9\\-_.]+)\\/([a-zA-Z0-9\\-_.]+)\\/releases(?:[\\/?].*)?$`,
      ),
      type: 'github-releases-list',
    },
    // Repo: /:owner/:repo
    {
      regex: new RegExp(
        `${prefix}\\/([a-zA-Z0-9\\-_.]+)\\/([a-zA-Z0-9\\-_.]+)\\/?$`,
      ),
      type: 'github-repo',
    },
  ];
}
