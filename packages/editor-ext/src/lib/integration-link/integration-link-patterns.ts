export type IntegrationLinkPattern = {
  provider: string;
  regex: RegExp;
};

export const integrationLinkPatterns: IntegrationLinkPattern[] = [
  // GitHub (cloud + GHE): /:owner/:repo/pull/:num or /issues/:num
  {
    provider: "github",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/(pull|issues)\/(\d+)/,
  },
  // GitLab (cloud + self-hosted): /-/issues/:num or /-/merge_requests/:num
  {
    provider: "gitlab",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/(issues|merge_requests)\/(\d+)/,
  },
  // Jira (cloud + server): /browse/KEY-123
  {
    provider: "jira",
    regex: /^https?:\/\/[^\/]+\/browse\/([A-Z][A-Z0-9]+-\d+)/,
  },
  // Linear (cloud only): /team/issue/KEY-123
  {
    provider: "linear",
    regex: /^https?:\/\/linear\.app\/([^\/]+)\/issue\/([A-Z]+-\d+)/,
  },
];

export function matchIntegrationLink(
  url: string,
): { provider: string; match: RegExpMatchArray } | null {
  for (const pattern of integrationLinkPatterns) {
    const match = url.match(pattern.regex);
    if (match) {
      return { provider: pattern.provider, match };
    }
  }
  return null;
}
