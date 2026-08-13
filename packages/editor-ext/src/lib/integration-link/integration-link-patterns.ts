export type IntegrationLinkPattern = {
  provider: string;
  type: string;
  regex: RegExp;
};

export const integrationLinkPatterns: IntegrationLinkPattern[] = [
  // Slack message permalink (host-specific; must precede the host-agnostic
  // GitHub patterns, whose repo form would swallow /archives/<channel>)
  {
    provider: "slack",
    type: "slack-message",
    regex:
      /^https?:\/\/[a-z0-9-]+\.slack\.com\/archives\/([a-zA-Z0-9-]+)\/p(\d+)(?:\?thread_ts=[\d.]+&cid=[A-Za-z\d]+)?$/,
  },
  // Slack channel
  {
    provider: "slack",
    type: "slack-channel",
    regex:
      /^https?:\/\/[a-z0-9-]+\.slack\.com\/archives\/([a-zA-Z0-9-]+)\/?$/,
  },
  // Jira issue (cloud + self-hosted): /browse/KEY-123, tolerating ?atlOrigin=…
  // Must precede the GitHub repo pattern, which would swallow the two-segment
  // /browse/KEY path on any host.
  {
    provider: "jira",
    type: "jira-issue",
    regex: /^https?:\/\/[^\/]+\/browse\/([A-Za-z0-9]+-\d+)/,
  },
  // Jira legacy board (cloud + self-hosted): RapidBoard.jspa?…selectedIssue=KEY
  {
    provider: "jira",
    type: "jira-issue",
    regex:
      /^https?:\/\/[^\/]+\/secure\/RapidBoard\.jspa\?(?:.*&)?selectedIssue=([A-Za-z0-9]+-\d+)/,
  },
  // Jira cloud board/backlog with a selected issue
  {
    provider: "jira",
    type: "jira-issue",
    regex:
      /^https?:\/\/[a-z0-9-]+\.atlassian\.net\/jira\/software(?:\/c)?\/projects\/[\w-]+\/boards\/\d+(?:\/\w+)?\?(?:.*&)?selectedIssue=([A-Za-z0-9]+-\d+)/,
  },
  // GitHub PR commit (must be before generic PR pattern)
  {
    provider: "github",
    type: "github-pr-commit",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/pull\/(\d+)\/commits\/([a-f0-9]+)/,
  },
  // GitHub PR (with optional /checks, /commits, /files sub-pages)
  {
    provider: "github",
    type: "github-pr",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/,
  },
  // GitHub issue
  {
    provider: "github",
    type: "github-issue",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/,
  },
  // GitHub commit
  {
    provider: "github",
    type: "github-commit",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/commits?\/([a-f0-9]+)/,
  },
  // GitHub file/blob
  {
    provider: "github",
    type: "github-file",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+?)(?:#L(\d+)(?:-L(\d+))?)?$/,
  },
  // GitHub pulls list
  {
    provider: "github",
    type: "github-pulls-list",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/pulls(?:\/.*)?(?:\?.*)?$/,
  },
  // GitHub releases list
  {
    provider: "github",
    type: "github-releases-list",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/releases(?:\/.*)?(?:\?.*)?$/,
  },
  // GitHub issues list
  {
    provider: "github",
    type: "github-issues-list",
    regex:
      /^https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)\/issues(?:\/(?:created_by|assigned)\/[\w.\/-]+)?\/?(?:\?.*)?$/,
  },
  // GitHub repo
  {
    provider: "github",
    type: "github-repo",
    regex:
      /^https?:\/\/[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/?$/,
  },
  // GitLab commit in MR diff (must be before generic MR pattern)
  {
    provider: "gitlab",
    type: "gitlab-commit-in-mr",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/merge_requests\/(\d+)\/diffs\?.*commit_id=([a-f0-9]+)/,
  },
  // GitLab merge request
  {
    provider: "gitlab",
    type: "gitlab-mr",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/merge_requests\/(\d+)/,
  },
  // GitLab issue
  {
    provider: "gitlab",
    type: "gitlab-issue",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/issues\/(\d+)/,
  },
  // GitLab work item (new URL format for issues)
  {
    provider: "gitlab",
    type: "gitlab-issue",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/work_items\/(\d+)/,
  },
  // GitLab work item opened as a drawer over the list (?show=base64 payload)
  {
    provider: "gitlab",
    type: "gitlab-work-item-drawer",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/work_items\/?\?(?:.*&)?show=/,
  },
  // GitLab commit
  {
    provider: "gitlab",
    type: "gitlab-commit",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/commits?\/([a-f0-9]+)/,
  },
  // GitLab issues list
  {
    provider: "gitlab",
    type: "gitlab-issues-list",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/issues\/?(?:\?.*)?$/,
  },
  // GitLab merge requests list
  {
    provider: "gitlab",
    type: "gitlab-merges-list",
    regex:
      /^https?:\/\/[^\/]+\/(.+)\/-\/merge_requests\/?(?:\?.*)?$/,
  },
  // GitLab project
  {
    provider: "gitlab",
    type: "gitlab-project",
    regex:
      /^https?:\/\/[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_]+)\/?$/,
  },
  // Google Docs
  {
    provider: "google_docs",
    type: "google-doc",
    regex: /^https?:\/\/docs\.google\.com\/document\/d\/([\w-]+)/,
  },
  // Google Sheets
  {
    provider: "google_docs",
    type: "google-sheet",
    regex: /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/,
  },
  // Google Slides
  {
    provider: "google_docs",
    type: "google-slides",
    regex: /^https?:\/\/docs\.google\.com\/presentation\/d\/([\w-]+)/,
  },
  // Google Forms
  {
    provider: "google_docs",
    type: "google-form",
    regex: /^https?:\/\/docs\.google\.com\/forms\/d\/([\w-]+)/,
  },
  // Google Drive file
  {
    provider: "google_docs",
    type: "google-drive-file",
    regex: /^https?:\/\/drive\.google\.com\/file\/d\/([\w-]+)/,
  },
  // Figma file (design, file, proto, board)
  {
    provider: "figma",
    type: "figma-file",
    regex:
      /^https?:\/\/([\w.-]+\.)?figma\.com\/(file|proto|board|design)\/([0-9a-zA-Z]{22,128})/,
  },
  // Linear issue: /team/issue/KEY-123(/:title-slug)?
  {
    provider: "linear",
    type: "linear-issue",
    regex:
      /^https?:\/\/linear\.app\/([^\/]+)\/issue\/([A-Z]+-\d+)(?:\/([^\/?#]+))?/,
  },
  // Linear project: /team/project/:slug(/:tab)?
  {
    provider: "linear",
    type: "linear-project",
    regex: /^https?:\/\/linear\.app\/([^\/]+)\/project\/([^\/]+)/,
  },
  // Linear initiative: /team/initiative/:slug(/:tab)?
  {
    provider: "linear",
    type: "linear-initiative",
    regex: /^https?:\/\/linear\.app\/([^\/]+)\/initiative\/([^\/]+)/,
  },
  // Linear view: /team/view/:id(/:tab)?
  {
    provider: "linear",
    type: "linear-view",
    regex: /^https?:\/\/linear\.app\/([^\/]+)\/view\/([^\/]+)/,
  },
];

export function matchIntegrationLink(
  url: string,
): { provider: string; type: string; match: RegExpMatchArray } | null {
  for (const pattern of integrationLinkPatterns) {
    const match = url.match(pattern.regex);
    if (match) {
      return { provider: pattern.provider, type: pattern.type, match };
    }
  }
  return null;
}

export type IntegrationLinkDescription = {
  provider: string;
  title: string;
  description?: string;
};

// Static, offline description of an integration url
export function describeIntegrationLink(
  url: string,
): IntegrationLinkDescription | null {
  const matched = matchIntegrationLink(url);
  if (!matched) return null;
  const { provider, type, match } = matched;

  const describe = (title: string, description?: string) => ({
    provider,
    title,
    description,
  });
  const repo = () => `${match[1]}/${match[2]}`;

  switch (type) {
    case "jira-issue":
      return describe(match[1], hostOf(url));

    case "github-pr":
      return describe(`Pull Request #${match[3]}`, repo());
    case "github-pr-commit":
      return describe(`Commit ${match[4].slice(0, 7)}`, repo());
    case "github-issue":
      return describe(`Issue #${match[3]}`, repo());
    case "github-commit":
      return describe(`Commit ${match[3].slice(0, 7)}`, repo());
    case "github-file":
      return describe(match[4], repo());
    case "github-pulls-list":
      return describe("Pull Requests", repo());
    case "github-issues-list":
      return describe("Issues", repo());
    case "github-releases-list":
      return describe("Releases", repo());
    case "github-repo":
      return describe(repo());

    case "gitlab-mr":
      return describe(`Merge Request !${match[2]}`, match[1]);
    case "gitlab-issue":
      return describe(`Issue #${match[2]}`, match[1]);
    case "gitlab-work-item-drawer": {
      const target = decodeWorkItemShowParam(url);
      return target
        ? describe(`Issue #${target.iid}`, target.fullPath)
        : describe("Work item", match[1]);
    }
    case "gitlab-commit":
      return describe(`Commit ${match[2].slice(0, 8)}`, match[1]);
    case "gitlab-commit-in-mr":
      return describe(`Commit ${match[3].slice(0, 8)}`, match[1]);
    case "gitlab-issues-list":
      return describe("Issues", match[1]);
    case "gitlab-merges-list":
      return describe("Merge Requests", match[1]);
    case "gitlab-project":
      return describe(repo());

    case "linear-issue":
      return describe(
        `Issue ${match[2]}`,
        (match[3] && humanizeSlug(match[3])) || match[1],
      );
    case "linear-project":
      return describe(humanizeSlug(match[2]) ?? "Project", "Project");
    case "linear-initiative":
      return describe(humanizeSlug(match[2]) ?? "Initiative", "Initiative");
    case "linear-view":
      return describe("View", match[1]);

    case "slack-message":
      return describe("Slack message", hostOf(url));
    case "slack-channel":
      return describe("Slack channel", hostOf(url));
    case "figma-file":
      return describe("Figma file", hostOf(url));
    case "google-doc":
      return describe("Google Doc");
    case "google-sheet":
      return describe("Google Sheet");
    case "google-slides":
      return describe("Google Slides");
    case "google-form":
      return describe("Google Form");
    case "google-drive-file":
      return describe("Google Drive file");

    default:
      return null;
  }
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

// "mobile-app-1b9607f47174" -> "Mobile app": slugs end in a hex id segment.
function humanizeSlug(slug: string): string | null {
  const name = slug
    .replace(/-[a-f0-9]{8,}$/, "")
    .replace(/-/g, " ")
    .trim();
  if (!name || /^[a-f0-9]{8,}$/.test(name)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// The work items list opens an item as a drawer and encodes it in the URL
// as ?show=base64({ iid, full_path, id }).
function decodeWorkItemShowParam(
  url: string,
): { fullPath: string; iid: number } | null {
  try {
    const show = new URL(url).searchParams.get("show");
    if (!show) return null;
    const payload = JSON.parse(
      atob(show.replace(/-/g, "+").replace(/_/g, "/")),
    );
    const iid = parseInt(payload.iid, 10);
    if (typeof payload.full_path !== "string" || Number.isNaN(iid)) {
      return null;
    }
    return { fullPath: payload.full_path, iid };
  } catch {
    return null;
  }
}
