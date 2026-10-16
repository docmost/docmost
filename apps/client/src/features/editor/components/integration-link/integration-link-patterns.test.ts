import {
  describeIntegrationLink,
  matchIntegrationLink,
} from "@docmost/editor-ext";
import { describe, expect, it } from "vitest";

const AZURE = "https://dev.azure.com/contoso";
const LEGACY_AZURE = "https://contoso.visualstudio.com";
const JIRA_HOSTS = { jira: ["jira.acme.com"] };

// Exercise matching through the public API; regex order and counts are implementation details.
describe("integration link matching", () => {
  it.each([
    ["https://github.com/docmost/docmost", "github", "github-repo"],
    ["https://gitlab.com/docmost/docmost", "gitlab", "gitlab-project"],
    ["https://code.example.com/o/r/pull/1", "github", "github-pr"],
    ["https://code.example.com/o/r/-/merge_requests/1", "gitlab", "gitlab-mr"],
  ])("identifies %s as %s", (url, provider, type) => {
    expect(matchIntegrationLink(url)).toMatchObject({ provider, type });
  });

  it.each([
    "https://example.com/foo/bar",
    "https://github.com/o/r/-/merge_requests/1",
    "https://gitlab.com/o/r/pull/1",
  ])("does not misclassify %s", (url) => {
    expect(matchIntegrationLink(url)).toBeNull();
  });

  it("restricts GitHub links to the configured Enterprise host", () => {
    const hosts = { github: ["github.acme.com"] };
    expect(
      matchIntegrationLink("https://github.acme.com/o/r", hosts),
    ).toMatchObject({ provider: "github", type: "github-repo" });
    expect(
      matchIntegrationLink("https://github.acme.com/o/r/pull/1", hosts),
    ).toMatchObject({ provider: "github", type: "github-pr" });
    expect(
      matchIntegrationLink("https://github.com/o/r/pull/1", hosts),
    ).toBeNull();
    expect(
      matchIntegrationLink("https://gitea.example.com/o/r/pull/1", hosts),
    ).toBeNull();
  });

  it("recognizes a self-managed GitLab project root", () => {
    expect(
      matchIntegrationLink("https://gitlab.acme.com/g/p", {
        gitlab: ["gitlab.acme.com"],
      }),
    ).toMatchObject({ provider: "gitlab", type: "gitlab-project" });
  });

  it("matches Jira wildcard subdomains without accepting lookalike hosts", () => {
    const hosts = { jira: ["*.atlassian.net", "*.jira.com"] };
    expect(
      matchIntegrationLink("https://acme.atlassian.net/browse/AB-1", hosts),
    ).toMatchObject({ provider: "jira", type: "jira-issue" });
    for (const host of [
      "atlassian.net",
      "evilatlassian.net",
      "jira.acme.com",
    ]) {
      expect(
        matchIntegrationLink(`https://${host}/browse/AB-1`, hosts),
      ).toBeNull();
    }
  });

  it("keeps default matching for providers without a configured host", () => {
    expect(
      matchIntegrationLink("https://code.example.com/o/r/pull/1", JIRA_HOSTS),
    ).toMatchObject({ provider: "github", type: "github-pr" });
    expect(
      matchIntegrationLink("https://acme.slack.com/archives/C123", {}),
    ).toMatchObject({ provider: "slack", type: "slack-channel" });
  });

  it.each([
    "https://github.com/o/r/pull/1\n",
    "https://github.com/o/r/pulls?" + "a".repeat(9000),
  ])("rejects whitespace or oversized input: %s", (url) => {
    expect(matchIntegrationLink(url)).toBeNull();
  });

  it.each([null, undefined])("rejects a link mark without an href: %s", (url) => {
    expect(matchIntegrationLink(url)).toBeNull();
  });

  it.each([
    ["https://github.com/o/r/pulls?q=is%3Aopen", "github-pulls-list"],
    ["https://github.com/o/r/pulls/extra", "github-pulls-list"],
    ["https://github.com/o/r/releases/tag/v1.0.0", "github-releases-list"],
  ])("recognizes the collection at %s", (url, type) => {
    expect(matchIntegrationLink(url)?.type).toBe(type);
  });

  it("does not treat a longer segment as a collection", () => {
    expect(matchIntegrationLink("https://github.com/o/r/pullsx")).toBeNull();
  });
});

describe("Azure DevOps links", () => {
  it.each([
    [
      `${AZURE}/Fabrikam/_git/web-app/pullrequest/318`,
      "azure-devops-pr",
      ["contoso", "Fabrikam", "web-app", "318"],
    ],
    [
      `${AZURE}/Fabrikam/_workitems/edit/318`,
      "azure-devops-work-item",
      ["contoso", "Fabrikam", "318"],
    ],
    [
      `${AZURE}/Fabrikam/_boards/board/?workitem=318`,
      "azure-devops-work-item",
      ["contoso", "Fabrikam", "318"],
    ],
    [
      `${LEGACY_AZURE}/Fabrikam/_git/web-app/pullrequest/318`,
      "azure-devops-pr",
      ["contoso", "Fabrikam", "web-app", "318"],
    ],
    [
      `${LEGACY_AZURE}/DefaultCollection/Fabrikam/_workitems/edit/318`,
      "azure-devops-work-item",
      ["contoso", "Fabrikam", "318"],
    ],
    [
      `${LEGACY_AZURE}/DefaultCollection/Fabrikam/_boards/board/?workitem=318`,
      "azure-devops-work-item",
      ["contoso", "Fabrikam", "318"],
    ],
    [
      `${AZURE}/_git/Fabrikam/pullrequest/318`,
      "azure-devops-pr",
      ["contoso", undefined, "Fabrikam", "318"],
    ],
    [
      `${LEGACY_AZURE}/_workitems/edit/318`,
      "azure-devops-work-item",
      ["contoso", undefined, "318"],
    ],
  ] as const)(
    "captures routing fields from %s and rejects invalid IDs",
    (url, type, groups) => {
      const result = matchIntegrationLink(url);
      expect(result).toMatchObject({ provider: "azure_devops", type });
      expect(result?.match.slice(1)).toEqual(groups);
      expect(matchIntegrationLink(`${url}x`)).toBeNull();
      expect(matchIntegrationLink(`${url}00000000`)).toBeNull();
    },
  );

  it("matches Azure links when other providers report their hosts", () => {
    expect(
      matchIntegrationLink(`${AZURE}/Fabrikam/_git/web-app/pullrequest/318`, {
        github: ["github.com"],
        jira: ["*.atlassian.net"],
      }),
    ).toMatchObject({ provider: "azure_devops", type: "azure-devops-pr" });
    expect(
      matchIntegrationLink(
        "https://dev.azure.com/browse/AB-1/_workitems/edit/5",
      ),
    ).toMatchObject({
      provider: "azure_devops",
      type: "azure-devops-work-item",
    });
  });

  it.each([
    "http://dev.azure.com/contoso/Fabrikam/_workitems/edit/1",
    "http://contoso.visualstudio.com/Fabrikam/_workitems/edit/1",
    "https://dev.azure.com.evil.com/contoso/Fabrikam/_workitems/edit/1",
    "https://contoso.visualstudio.com.evil.com/Fabrikam/_workitems/edit/1",
    "https://dev.azure.com/con_toso/Fabrikam/_workitems/edit/1",
    "https://dev.azure.com/con%2Ftoso/Fabrikam/_workitems/edit/1",
    `${AZURE}/_Fabrikam/_workitems/edit/1`,
    `${AZURE}/Fabrikam/_git/web-app?workitem=42`,
    `${AZURE}/Fabrikam/_boardsx/board/?workitem=42`,
    `${AZURE}/Fabrikam/_boards/board/?xworkitem=42`,
    `${LEGACY_AZURE}/Fabrikam/boards/board/?workitem=42`,
  ])("rejects an unsupported or misleading URL: %s", (url) => {
    expect(matchIntegrationLink(url)).toBeNull();
  });

  it("reads work items from board, backlog and sprint hubs on both hosts", () => {
    for (const host of [AZURE, LEGACY_AZURE]) {
      for (const hub of [
        "_boards/board",
        "_backlogs/backlog",
        "_sprints/taskboard",
      ]) {
        const url = `${host}/Fabrikam/${hub}/Team?showParents=true&workitem=42`;
        expect(matchIntegrationLink(url)?.match.slice(1), url).toEqual([
          "contoso",
          "Fabrikam",
          "42",
        ]);
      }
    }
  });

  it.each([
    [
      `${AZURE}/Fabrikam%20Fiber/_workitems/edit/1234`,
      "Work Item #1234",
      "contoso/Fabrikam Fiber",
    ],
    [
      `${AZURE}/Fabrikam/_git/web%20app/pullrequest/318`,
      "Pull Request #318",
      "contoso/Fabrikam/web app",
    ],
    [
      `${AZURE}/_git/Fabrikam/pullrequest/9`,
      "Pull Request #9",
      "contoso/Fabrikam",
    ],
    [`${AZURE}/_workitems/edit/7`, "Work Item #7", "contoso"],
  ])("describes %s without a connection", (url, title, description) => {
    expect(describeIntegrationLink(url)).toEqual({
      provider: "azure_devops",
      title,
      description,
    });
  });

  it.each([
    ["Fab%0Arikam", "Fab%0Arikam"],
    ["Fab%E2%80%AErikam", "Fab%E2%80%AErikam"],
    ["Fab%E2%80%A8rikam", "Fab%E2%80%A8rikam"],
    ["Fab%ZZ", "Fab%ZZ"],
    ["Fab\u202erikam", "Fab%E2%80%AErikam"],
    ["a%2Fb", "a%2Fb"],
    ["Caf%C3%A9", "Café"],
  ])("keeps decoded project names safe: %s", (project, expected) => {
    expect(
      describeIntegrationLink(`${AZURE}/${project}/_workitems/edit/1`)
        ?.description,
    ).toBe(`contoso/${expected}`);
  });
});

describe("URL path boundaries", () => {
  // Representative providers and failure classes instead of every route permutation.
  it.each([
    "https://github.com/a/b/pull/1/../../../../evil/x/pull/2",
    "https://github.com/a/b/pull/1/%2e%2e/evil",
    "https://github.com/a/b/pull/1\\..\\evil",
    "https://gitlab.com/a/b/../../evil/x/-/issues/1",
    "https://linear.app/acme/issue/ABC-1/../../../evil/issue/XYZ-2",
    "https://acme.atlassian.net/browse/AB-1/%2e%2e/browse/EVIL-2",
    `${AZURE}/Fabrikam/_git/web-app/pullrequest/318/../../evil`,
    `${LEGACY_AZURE}/Fabrikam/_workitems/edit/1\\..\\evil`,
  ])("rejects paths the browser resolves elsewhere: %s", (url) => {
    expect(matchIntegrationLink(url)).toBeNull();
  });

  it.each([
    ["https://github.com/o/.github/pull/1", "github-pr"],
    ["https://github.com/o/my..repo/issues/2", "github-issue"],
    [
      "https://github.com/o/r/blob/main/.github/workflows/ci.yml#L1-L3",
      "github-file",
    ],
    ["https://github.com/o/r/pulls?q=../../x", "github-pulls-list"],
    ["https://linear.app/acme/issue/ABC-1#comment-1/../..", "linear-issue"],
    ["https://acme.atlassian.net/browse/AB-1?atlOrigin=x/../..", "jira-issue"],
    [
      `${AZURE}/Fabrikam/_git/web-app/pullrequest/318?_a=files&path=/../x`,
      "azure-devops-pr",
    ],
  ])("allows dots in names, query strings and fragments: %s", (url, type) => {
    expect(matchIntegrationLink(url)?.type).toBe(type);
  });

  it("applies the same path guard on an Enterprise host", () => {
    expect(
      matchIntegrationLink("https://github.acme.com/a/b/pull/1/../../evil", {
        github: ["github.acme.com"],
      }),
    ).toBeNull();
  });

  it.each([
    "https://github.com/o/r?x=/pull/1",
    "https://github.com/o/r#x/pull/1",
    "https://github.com/o?x=/r/issues/1",
  ])("does not read a route from an owner or repository query: %s", (url) => {
    expect(matchIntegrationLink(url)).toBeNull();
  });

  it("captures ordinary dots, dashes and underscores in repository names", () => {
    expect(
      matchIntegrationLink(
        "https://github.com/my-org_1/repo.name-x/pull/1",
      )?.match.slice(1),
    ).toEqual(["my-org_1", "repo.name-x", "1"]);
  });
});

describe("Jira Data Center context paths", () => {
  it.each([
    "https://jira.acme.com/jira/browse/AB-1",
    "https://jira.acme.com/tools/jira/browse/AB-1",
    "https://jira.acme.com/jira/secure/RapidBoard.jspa?rapidView=1&selectedIssue=AB-1",
  ])("reads the issue under an installed context path: %s", (url) => {
    const result = matchIntegrationLink(url, JIRA_HOSTS);
    expect(result).toMatchObject({ provider: "jira", type: "jira-issue" });
    expect(result?.match.slice(1)).toEqual(["AB-1"]);
    expect(matchIntegrationLink(url)).toBeNull();
    expect(matchIntegrationLink(url, { jira: ["jira.other.com"] })).toBeNull();
  });

  it("takes the first issue key after the context path", () => {
    expect(
      matchIntegrationLink(
        "https://jira.acme.com/jira/browse/AB-1/browse/CD-2",
        JIRA_HOSTS,
      )?.match[1],
    ).toBe("AB-1");
  });

  it("handles an uppercase Cloud host when matching a selected board issue", () => {
    expect(
      matchIntegrationLink(
        "https://ACME.Atlassian.net/jira/software/projects/AB/boards/1?selectedIssue=AB-12",
        {
          jira: ["*.atlassian.net"],
        },
      ),
    ).toMatchObject({ provider: "jira", type: "jira-issue" });
  });

  it.each([
    "https://jira.acme.com/jira/../browse/AB-1",
    "https://jira.acme.com/jira/%2e%2e/browse/AB-1",
    "https://jira.acme.com/jira\\..\\browse/AB-1",
  ])("rejects context paths the browser resolves elsewhere: %s", (url) => {
    expect(matchIntegrationLink(url, JIRA_HOSTS)).toBeNull();
  });
});
