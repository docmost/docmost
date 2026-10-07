export type IntegrationLinkPattern = {
  provider: string;
  type: string;
  regex: RegExp;
  // Matches only on a host the provider reports serving.
  requiresProviderHost?: boolean;
};

export const integrationLinkPatterns: IntegrationLinkPattern[] = [
  // Slack message permalink (must precede the host-agnostic GitHub repo pattern)
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
  // Azure DevOps captures org, project?, repo, id for a pull request and org, project?, id for a work item.
  {
    provider: "azure_devops",
    type: "azure-devops-pr",
    regex:
      /^https:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))dev\.azure\.com\/([A-Za-z0-9-]+)(?:\/((?!_)[^\/?#]+))?\/_git\/([^\/?#]+)\/pullrequest\/(\d{1,10})(?=[\/?#]|$)/,
  },
  {
    provider: "azure_devops",
    type: "azure-devops-work-item",
    regex:
      /^https:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))dev\.azure\.com\/([A-Za-z0-9-]+)(?:\/((?!_)[^\/?#]+))?\/_workitems\/edit\/(\d{1,10})(?=[\/?#]|$)/,
  },
  // Azure DevOps board, backlog or sprint with an open work item
  {
    provider: "azure_devops",
    type: "azure-devops-work-item",
    regex:
      /^https:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))dev\.azure\.com\/([A-Za-z0-9-]+)\/((?!_)[^\/?#]+)\/_(?:boards|backlogs|sprints)\/[^?#]*\?(?:[^#]*&)?workitem=(\d{1,10})(?=[&#]|$)/,
  },
  // Azure DevOps legacy host
  {
    provider: "azure_devops",
    type: "azure-devops-pr",
    regex:
      /^https:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))([A-Za-z0-9-]+)\.visualstudio\.com(?:\/DefaultCollection)?(?:\/((?!_)[^\/?#]+))?\/_git\/([^\/?#]+)\/pullrequest\/(\d{1,10})(?=[\/?#]|$)/,
  },
  {
    provider: "azure_devops",
    type: "azure-devops-work-item",
    regex:
      /^https:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))([A-Za-z0-9-]+)\.visualstudio\.com(?:\/DefaultCollection)?(?:\/((?!_)[^\/?#]+))?\/_workitems\/edit\/(\d{1,10})(?=[\/?#]|$)/,
  },
  {
    provider: "azure_devops",
    type: "azure-devops-work-item",
    regex:
      /^https:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))([A-Za-z0-9-]+)\.visualstudio\.com(?:\/DefaultCollection)?\/((?!_)[^\/?#]+)\/_(?:boards|backlogs|sprints)\/[^?#]*\?(?:[^#]*&)?workitem=(\d{1,10})(?=[&#]|$)/,
  },
  // Jira issue (cloud + self-hosted): /browse/KEY-123 (must precede the GitHub repo pattern)
  {
    provider: "jira",
    type: "jira-issue",
    regex: /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/browse\/([A-Za-z0-9]+-\d+)/,
  },
  // Jira legacy board (cloud + self-hosted): RapidBoard.jspa?…selectedIssue=KEY
  {
    provider: "jira",
    type: "jira-issue",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/secure\/RapidBoard\.jspa\?(?:.*&)?selectedIssue=([A-Za-z0-9]+-\d+)/,
  },
  // Jira cloud board/backlog with a selected issue
  {
    provider: "jira",
    type: "jira-issue",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[A-Za-z0-9-]+\.[Aa][Tt][Ll][Aa][Ss][Ss][Ii][Aa][Nn]\.[Nn][Ee][Tt]\/jira\/software(?:\/c)?\/projects\/[\w-]+\/boards\/\d+(?:\/\w+)?\?(?:.*&)?selectedIssue=([A-Za-z0-9]+-\d+)/,
  },
  // Jira Data Center under a context path, e.g. /jira/browse/KEY-123
  {
    provider: "jira",
    type: "jira-issue",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+(?:\/[^\/?#]+)+?\/browse\/([A-Za-z0-9]+-\d+)/,
    requiresProviderHost: true,
  },
  {
    provider: "jira",
    type: "jira-issue",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+(?:\/[^\/?#]+)+?\/secure\/RapidBoard\.jspa\?(?:.*&)?selectedIssue=([A-Za-z0-9]+-\d+)/,
    requiresProviderHost: true,
  },
  // GitHub PR commit (must be before generic PR pattern)
  {
    provider: "github",
    type: "github-pr-commit",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/pull\/(\d+)\/commits\/([a-f0-9]+)/,
  },
  // GitHub PR (with optional /checks, /commits, /files sub-pages)
  {
    provider: "github",
    type: "github-pr",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/pull\/(\d+)/,
  },
  // GitHub issue
  {
    provider: "github",
    type: "github-issue",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/issues\/(\d+)/,
  },
  // GitHub commit
  {
    provider: "github",
    type: "github-commit",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/commits?\/([a-f0-9]+)/,
  },
  // GitHub file/blob
  {
    provider: "github",
    type: "github-file",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/blob\/([^\/]+)\/(.+?)(?:#L(\d+)(?:-L(\d+))?)?$/,
  },
  // GitHub pulls list
  {
    provider: "github",
    type: "github-pulls-list",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/pulls(?:[\/?].*)?$/,
  },
  // GitHub releases list
  {
    provider: "github",
    type: "github-releases-list",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/releases(?:[\/?].*)?$/,
  },
  // GitHub issues list
  {
    provider: "github",
    type: "github-issues-list",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/issues(?:\/(?:created_by|assigned)\/[\w.\/-]+)?\/?(?:\?.*)?$/,
  },
  // GitHub repo
  {
    provider: "github",
    type: "github-repo",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/?$/,
  },
  // GitLab commit in MR diff (must be before generic MR pattern)
  {
    provider: "gitlab",
    type: "gitlab-commit-in-mr",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/(.+)\/-\/merge_requests\/(\d+)\/diffs\?.*commit_id=([a-f0-9]+)/,
  },
  // GitLab merge request
  {
    provider: "gitlab",
    type: "gitlab-mr",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/(.+)\/-\/merge_requests\/(\d+)/,
  },
  // GitLab issue
  {
    provider: "gitlab",
    type: "gitlab-issue",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/(.+)\/-\/issues\/(\d+)/,
  },
  // GitLab work item, treated as an issue
  {
    provider: "gitlab",
    type: "gitlab-issue",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/(.+)\/-\/work_items\/(\d+)/,
  },
  // GitLab work item opened as a drawer over the list (?show=base64 payload)
  {
    provider: "gitlab",
    type: "gitlab-work-item-drawer",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/(.+)\/-\/work_items\/?\?(?:.*&)?show=/,
  },
  // GitLab commit
  {
    provider: "gitlab",
    type: "gitlab-commit",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/(.+)\/-\/commits?\/([a-f0-9]+)/,
  },
  // GitLab issues list
  {
    provider: "gitlab",
    type: "gitlab-issues-list",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/(.+)\/-\/issues\/?(?:\?.*)?$/,
  },
  // GitLab merge requests list
  {
    provider: "gitlab",
    type: "gitlab-merges-list",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/(.+)\/-\/merge_requests\/?(?:\?.*)?$/,
  },
  // GitLab project
  {
    provider: "gitlab",
    type: "gitlab-project",
    regex:
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))[^\/]+\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_]+)\/?$/,
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
      /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))linear\.app\/([^\/]+)\/issue\/([A-Z]+-\d+)(?:\/([^\/?#]+))?/,
  },
  // Linear project: /team/project/:slug(/:tab)?
  {
    provider: "linear",
    type: "linear-project",
    regex: /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))linear\.app\/([^\/]+)\/project\/([^\/]+)/,
  },
  // Linear initiative: /team/initiative/:slug(/:tab)?
  {
    provider: "linear",
    type: "linear-initiative",
    regex: /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))linear\.app\/([^\/]+)\/initiative\/([^\/]+)/,
  },
  // Linear view: /team/view/:id(/:tab)?
  {
    provider: "linear",
    type: "linear-view",
    regex: /^https?:\/\/(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))linear\.app\/([^\/]+)\/view\/([^\/]+)/,
  },
];

const MAX_INTEGRATION_LINK_LENGTH = 8192;

// Provider type -> hostnames it unfurls; "*.example.com" means any subdomain.
export type IntegrationUnfurlHosts = Record<string, string[]>;

function isUnfurlHost(hostname: string, hosts: string[]): boolean {
  return hosts.some((host) =>
    host.startsWith("*.") ? hostname.endsWith(host.slice(1)) : hostname === host,
  );
}

export function matchIntegrationLink(
  url: string,
  unfurlHosts?: IntegrationUnfurlHosts,
): { provider: string; type: string; match: RegExpMatchArray } | null {
  // Real URLs carry no whitespace; the cap bounds regex backtracking on hostile input.
  if (url.length > MAX_INTEGRATION_LINK_LENGTH || /\s/.test(url)) {
    return null;
  }

  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  const providerHosts = unfurlHosts ?? {};
  const servesHost = (provider: string) =>
    !providerHosts[provider] || isUnfurlHost(hostname, providerHosts[provider]);
  // A host a provider reports serving (e.g. GitHub Enterprise) is that provider's.
  const hostProvider = Object.keys(providerHosts).find(
    (provider) => providerHosts[provider] && servesHost(provider),
  );
  const publicCodeHostProvider =
    hostname === "github.com" || hostname === "www.github.com"
      ? "github"
      : hostname === "gitlab.com" || hostname === "www.gitlab.com"
        ? "gitlab"
        : null;
  const preferredProvider = hostProvider ?? publicCodeHostProvider;
  const candidatePatterns = integrationLinkPatterns.filter(
    (pattern) =>
      (!preferredProvider || pattern.provider === preferredProvider) &&
      servesHost(pattern.provider) &&
      (!pattern.requiresProviderHost || pattern.provider === hostProvider),
  );

  for (const pattern of candidatePatterns) {
    const match = url.match(pattern.regex);
    if (!match) continue;

    const isAmbiguousProjectRoot =
      pattern.type === "github-repo" || pattern.type === "gitlab-project";
    if (isAmbiguousProjectRoot && !preferredProvider) continue;

    return { provider: pattern.provider, type: pattern.type, match };
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

    case "azure-devops-work-item":
      return describe(
        `Work Item #${match[3]}`,
        [match[1], match[2] && safeDecode(match[2])].filter(Boolean).join("/"),
      );
    case "azure-devops-pr":
      return describe(
        `Pull Request #${match[4]}`,
        [match[1], match[2] && safeDecode(match[2]), safeDecode(match[3])]
          .filter(Boolean)
          .join("/"),
      );

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

// Slashes and control, format (bidi, zero-width) or separator characters could disguise a url's display text.
const UNSAFE_DISPLAY_TEXT = /[\/\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

function encodeUnsafe(text: string): string {
  return text.replace(UNSAFE_DISPLAY_TEXT, encodeURIComponent);
}

function safeDecode(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return encodeUnsafe(value);
  }
  return encodeUnsafe(decoded) === decoded ? decoded : encodeUnsafe(value);
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

// A GitLab work item drawer is encoded as ?show=base64({ iid, full_path, id }).
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
