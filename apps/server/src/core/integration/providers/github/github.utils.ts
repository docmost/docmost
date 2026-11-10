import { UnfurlForbiddenError } from '../../registry/integration-provider.interface';

export function repoApiPath(owner: string, repo: string): string {
  // encodeURIComponent keeps . and .., which the URL parser would resolve out of the path.
  if ([owner, repo].some((name) => name === '.' || name === '..')) {
    throw new UnfurlForbiddenError('GitHub repository path has a dot segment');
  }
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}
