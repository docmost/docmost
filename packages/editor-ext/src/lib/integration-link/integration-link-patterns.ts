export type IntegrationLinkPattern = {
  provider: string;
  regex: RegExp;
};

export const integrationLinkPatterns: IntegrationLinkPattern[] = [
  // GitHub PR commit (must be before generic PR pattern)
  {
    provider: "github",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/pull\/(\d+)\/commits\/([a-f0-9]+)/,
  },
  // GitHub PR (with optional /checks, /commits, /files sub-pages)
  {
    provider: "github",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/,
  },
  // GitHub issue
  {
    provider: "github",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/,
  },
  // GitHub commit
  {
    provider: "github",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/commits?\/([a-f0-9]+)/,
  },
  // GitHub file/blob
  {
    provider: "github",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+?)(?:#L(\d+)(?:-L(\d+))?)?$/,
  },
  // GitHub pulls list
  {
    provider: "github",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/pulls(?:\/.*)?(?:\?.*)?$/,
  },
  // GitHub releases list
  {
    provider: "github",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/releases(?:\/.*)?(?:\?.*)?$/,
  },
  // GitHub issues list
  {
    provider: "github",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/issues(?:\/(?:created_by|assigned)\/[\w.\/-]+)?\/?(?:\?.*)?$/,
  },
  // GitHub repo
  {
    provider: "github",
    regex:
      /^https?:\/\/[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/?$/,
  },
  // GitLab commit in MR diff (must be before generic MR pattern)
  {
    provider: "gitlab",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/merge_requests\/(\d+)\/diffs\?.*commit_id=([a-f0-9]+)/,
  },
  // GitLab merge request
  {
    provider: "gitlab",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/merge_requests\/(\d+)/,
  },
  // GitLab issue
  {
    provider: "gitlab",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/issues\/(\d+)/,
  },
  // GitLab commit
  {
    provider: "gitlab",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/commits?\/([a-f0-9]+)/,
  },
  // GitLab issues list
  {
    provider: "gitlab",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/issues\/?(?:\?.*)?$/,
  },
  // GitLab merge requests list
  {
    provider: "gitlab",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/merge_requests\/?(?:\?.*)?$/,
  },
  // GitLab project
  {
    provider: "gitlab",
    regex:
      /^https?:\/\/[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_]+)\/?$/,
  },
  // Google Docs
  {
    provider: "google_docs",
    regex: /^https?:\/\/docs\.google\.com\/document\/d\/([\w-]+)/,
  },
  // Google Sheets
  {
    provider: "google_docs",
    regex: /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/,
  },
  // Google Slides
  {
    provider: "google_docs",
    regex: /^https?:\/\/docs\.google\.com\/presentation\/d\/([\w-]+)/,
  },
  // Google Forms
  {
    provider: "google_docs",
    regex: /^https?:\/\/docs\.google\.com\/forms\/d\/([\w-]+)/,
  },
  // Google Drive file
  {
    provider: "google_docs",
    regex: /^https?:\/\/drive\.google\.com\/file\/d\/([\w-]+)/,
  },
  // Figma file (design, file, proto, board)
  {
    provider: "figma",
    regex:
      /^https?:\/\/([\w.-]+\.)?figma\.com\/(file|proto|board|design)\/([0-9a-zA-Z]{22,128})/,
  },
  // Jira (cloud + server): /browse/KEY-123
  {
    provider: "jira",
    regex: /^https?:\/\/[^\/]+\/browse\/([A-Z][A-Z0-9]+-\d+)/,
  },
  // Linear issue: /team/issue/KEY-123(/:title-slug)?
  {
    provider: "linear",
    regex: /^https?:\/\/linear\.app\/([^\/]+)\/issue\/([A-Z]+-\d+)/,
  },
  // Linear project: /team/project/:slug(/:tab)?
  {
    provider: "linear",
    regex: /^https?:\/\/linear\.app\/([^\/]+)\/project\/([^\/]+)/,
  },
  // Linear initiative: /team/initiative/:slug(/:tab)?
  {
    provider: "linear",
    regex: /^https?:\/\/linear\.app\/([^\/]+)\/initiative\/([^\/]+)/,
  },
  // Linear view: /team/view/:id(/:tab)?
  {
    provider: "linear",
    regex: /^https?:\/\/linear\.app\/([^\/]+)\/view\/([^\/]+)/,
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
