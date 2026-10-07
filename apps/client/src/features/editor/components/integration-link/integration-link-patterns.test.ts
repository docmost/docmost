import {
  describeIntegrationLink,
  integrationLinkPatterns,
  matchIntegrationLink,
} from "@docmost/editor-ext";
import { describe, expect, it } from "vitest";

describe("matchIntegrationLink provider disambiguation", () => {
  it("prefers the public GitLab host for two-segment project URLs", () => {
    expect(
      matchIntegrationLink("https://gitlab.com/docmost/docmost"),
    ).toMatchObject({ provider: "gitlab", type: "gitlab-project" });
  });

  it("matches GitHub repository URLs on the public GitHub host", () => {
    expect(
      matchIntegrationLink("https://github.com/docmost/docmost"),
    ).toMatchObject({ provider: "github", type: "github-repo" });
  });

  it("does not classify an ordinary two-segment website as a code host", () => {
    expect(matchIntegrationLink("https://example.com/foo/bar")).toBeNull();
  });

  it("keeps distinctive self-hosted GitHub and GitLab routes", () => {
    expect(
      matchIntegrationLink(
        "https://code.example.com/docmost/docmost/pull/2475",
      ),
    ).toMatchObject({ provider: "github", type: "github-pr" });
    expect(
      matchIntegrationLink(
        "https://code.example.com/docmost/docmost/-/merge_requests/2475",
      ),
    ).toMatchObject({ provider: "gitlab", type: "gitlab-mr" });
  });

  it("does not cross-match provider-specific paths on public hosts", () => {
    expect(
      matchIntegrationLink(
        "https://github.com/docmost/docmost/-/merge_requests/2475",
      ),
    ).toBeNull();
    expect(
      matchIntegrationLink("https://gitlab.com/docmost/docmost/pull/2475"),
    ).toBeNull();
  });
});

describe("matchIntegrationLink with provider unfurl hosts", () => {
  it("rejects a GitHub-like path on a host GitHub does not serve", () => {
    const hosts = { github: ["github.com"] };
    expect(
      matchIntegrationLink("https://gitea.example.com/team/app/pulls/7", hosts),
    ).toBeNull();
    expect(
      matchIntegrationLink("https://blog.example.com/a/b/issues/3", hosts),
    ).toBeNull();
    expect(
      matchIntegrationLink("https://github.com/team/app/pull/7", hosts),
    ).toMatchObject({ provider: "github", type: "github-pr" });
  });

  it("matches GitHub Enterprise links, including repo roots, and not github.com", () => {
    const hosts = { github: ["github.acme.com"] };
    expect(
      matchIntegrationLink("https://github.acme.com/o/r/pull/1", hosts),
    ).toMatchObject({ provider: "github", type: "github-pr" });
    expect(
      matchIntegrationLink("https://github.acme.com/o/r", hosts),
    ).toMatchObject({ provider: "github", type: "github-repo" });
    expect(
      matchIntegrationLink("https://github.com/o/r/pull/1", hosts),
    ).toBeNull();
    expect(matchIntegrationLink("https://github.com/o/r", hosts)).toBeNull();
  });

  it("matches a self-managed GitLab project root on its configured host", () => {
    expect(
      matchIntegrationLink("https://gitlab.acme.com/g/p", {
        gitlab: ["gitlab.acme.com"],
      }),
    ).toMatchObject({ provider: "gitlab", type: "gitlab-project" });
  });

  it("matches Jira cloud wildcards on subdomains only", () => {
    const hosts = { jira: ["*.atlassian.net", "*.jira.com"] };
    expect(
      matchIntegrationLink("https://acme.atlassian.net/browse/AB-1", hosts),
    ).toMatchObject({ provider: "jira", type: "jira-issue" });
    expect(
      matchIntegrationLink("https://atlassian.net/browse/AB-1", hosts),
    ).toBeNull();
    expect(
      matchIntegrationLink("https://evilatlassian.net/browse/AB-1", hosts),
    ).toBeNull();
    expect(
      matchIntegrationLink("https://jira.acme.com/browse/AB-1", hosts),
    ).toBeNull();
  });

  it("keeps host-agnostic matching for providers without an entry", () => {
    const hosts = { jira: ["jira.acme.com"] };
    expect(
      matchIntegrationLink("https://code.example.com/o/r/pull/2475", hosts),
    ).toMatchObject({ provider: "github", type: "github-pr" });
    expect(
      matchIntegrationLink("https://github.com/o/r", hosts),
    ).toMatchObject({ provider: "github", type: "github-repo" });
    expect(
      matchIntegrationLink("https://acme.slack.com/archives/C123", hosts),
    ).toMatchObject({ provider: "slack", type: "slack-channel" });
  });

  it("treats an empty map like no map", () => {
    expect(
      matchIntegrationLink("https://code.example.com/o/r/pull/2475", {}),
    ).toMatchObject({ provider: "github", type: "github-pr" });
    expect(matchIntegrationLink("https://example.com/foo/bar", {})).toBeNull();
  });
});

describe("matchIntegrationLink input hardening", () => {
  const crafted = "https://github.com/o/r/pulls/" + "?".repeat(40000) + "\n";

  it("returns quickly on a crafted 40 KB href with a trailing newline", () => {
    const started = performance.now();
    expect(matchIntegrationLink(crafted)).toBeNull();
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("keeps the pulls list pattern itself linear", () => {
    const pulls = integrationLinkPatterns.find(
      (pattern) => pattern.type === "github-pulls-list",
    )!;
    const started = performance.now();
    expect(pulls.regex.test(crafted)).toBe(false);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("rejects a URL containing whitespace", () => {
    expect(matchIntegrationLink("https://github.com/o r/repo/pulls")).toBeNull();
  });

  it("rejects a URL longer than the cap", () => {
    expect(
      matchIntegrationLink("https://github.com/o/r/pulls?" + "a".repeat(9000)),
    ).toBeNull();
  });

  it.each([
    "https://github.com/o/r/pulls",
    "https://github.com/o/r/pulls/",
    "https://github.com/o/r/pulls?q=is%3Aopen",
    "https://github.com/o/r/pulls/extra",
    "https://github.com/o/r/releases",
    "https://github.com/o/r/releases/tag/v1.0.0?x=1",
  ])("still matches the list URL %s", (url) => {
    expect(matchIntegrationLink(url)?.type).toMatch(/^github-(pulls|releases)-list$/);
  });

  it("does not treat a longer path segment as the list", () => {
    expect(matchIntegrationLink("https://github.com/o/r/pullsx")).toBeNull();
  });
});

describe("Azure DevOps links", () => {
  it("matches work items and pull requests on both hosts", () => {
    expect(
      matchIntegrationLink(
        "https://dev.azure.com/contoso/Fabrikam/_workitems/edit/1234",
      ),
    ).toMatchObject({ provider: "azure_devops", type: "azure-devops-work-item" });
    expect(
      matchIntegrationLink(
        "https://dev.azure.com/contoso/Fabrikam/_boards/board/t/Team/Stories/?workitem=42",
      ),
    ).toMatchObject({ provider: "azure_devops", type: "azure-devops-work-item" });
    expect(
      matchIntegrationLink(
        "https://dev.azure.com/contoso/Fabrikam/_git/web-app/pullrequest/318?_a=files",
      ),
    ).toMatchObject({ provider: "azure_devops", type: "azure-devops-pr" });
    expect(
      matchIntegrationLink(
        "https://contoso.visualstudio.com/DefaultCollection/Fabrikam/_workitems/edit/55",
      ),
    ).toMatchObject({ provider: "azure_devops", type: "azure-devops-work-item" });
    expect(
      matchIntegrationLink(
        "https://contoso.visualstudio.com/_git/Fabrikam/pullrequest/9",
      ),
    ).toMatchObject({ provider: "azure_devops", type: "azure-devops-pr" });
  });

  it("captures the same groups as the server patterns", () => {
    expect(
      matchIntegrationLink(
        "https://dev.azure.com/contoso/_git/Fabrikam/pullrequest/9",
      )?.match.slice(1),
    ).toEqual(["contoso", undefined, "Fabrikam", "9"]);
    expect(
      matchIntegrationLink(
        "https://contoso.visualstudio.com/Fabrikam/_workitems/edit/55",
      )?.match.slice(1),
    ).toEqual(["contoso", "Fabrikam", "55"]);
    expect(
      matchIntegrationLink(
        "https://dev.azure.com/contoso/Fabrikam/_backlogs/backlog/Team/Stories/?showParents=true&workitem=42",
      )?.match.slice(1),
    ).toEqual(["contoso", "Fabrikam", "42"]);
  });

  it("still matches when other providers report their hosts", () => {
    const hosts = {
      github: ["github.com"],
      gitlab: ["gitlab.com"],
      jira: ["*.atlassian.net"],
    };
    expect(
      matchIntegrationLink(
        "https://dev.azure.com/contoso/Fabrikam/_git/web-app/pullrequest/318",
        hosts,
      ),
    ).toMatchObject({ provider: "azure_devops", type: "azure-devops-pr" });
  });

  it("rejects lookalike hosts, plain http and pages that are not an item", () => {
    for (const url of [
      "https://dev.azure.com.evil.com/contoso/Fabrikam/_workitems/edit/1",
      "https://contoso.visualstudio.com.evil.com/Fabrikam/_workitems/edit/1",
      "https://evil.com/?next=https://dev.azure.com/contoso/Fabrikam/_workitems/edit/1",
      "https://dev-azure.com/contoso/Fabrikam/_workitems/edit/1",
      "https://contoso-visualstudio.com/Fabrikam/_workitems/edit/1",
      "https://dev.azure.com/con_toso/Fabrikam/_workitems/edit/1",
      "https://dev.azure.com/con%2Ftoso/Fabrikam/_workitems/edit/1",
      "https://evil.com/?next=https://contoso.visualstudio.com/Fabrikam/_workitems/edit/1",
      "http://contoso.visualstudio.com/Fabrikam/_workitems/edit/1",
      "https://dev.azure-com/contoso/Fabrikam/_workitems/edit/1",
      "https://contoso.visualstudio-com/Fabrikam/_workitems/edit/1",
      "https://dev.azure.com/contoso/_settings/_boards/?workitem=1",
      "http://dev.azure.com/contoso/Fabrikam/_workitems/edit/1",
      "https://tfs.contoso.com/tfs/DefaultCollection/Fabrikam/_workitems/edit/1",
      "https://dev.azure.com/contoso/Fabrikam",
      "https://dev.azure.com/contoso/Fabrikam/_workitems/edit/12abc",
      "https://dev.azure.com/contoso/Fabrikam/_workitems/edit/12345678901",
      "https://dev.azure.com/contoso/Fabrikam/_git/web-app",
      "https://dev.azure.com/contoso/Fabrikam/_git/web-app/pullrequests?_a=active",
      "https://dev.azure.com/contoso/Fabrikam/_git/web-app/commit/abc123",
      "https://dev.azure.com/contoso/Fabrikam/_build/results?buildId=77",
      "https://dev.azure.com/contoso/Fabrikam/_git/web-app?workitem=42",
      "https://dev.azure.com/contoso/Fabrikam/_wiki/wikis/Fabrikam.wiki/1/Home?workitem=42",
      "https://dev.azure.com/contoso/Fabrikam/_build/results?buildId=77&workitem=42",
      "https://dev.azure.com/contoso/Fabrikam/_boardsx/board/?workitem=42",
      "https://contoso.visualstudio.com/Fabrikam/_git/web-app?workitem=42",
      "https://contoso.visualstudio.com/Fabrikam/_wiki/wikis/Fabrikam.wiki/1/Home?workitem=42",
      "https://contoso.visualstudio.com/Fabrikam/_build/results?buildId=77&workitem=42",
      "https://contoso.visualstudio.com/Fabrikam/_boardsx/board/?workitem=42",
    ]) {
      expect(matchIntegrationLink(url), url).toBeNull();
    }
  });

  it("refuses links with dot segments or a backslash", () => {
    for (const url of [
      "https://dev.azure.com/contoso/Fabrikam/_git/web-app/pullrequest/318/../../../../evil/_git/x/pullrequest/2",
      "https://dev.azure.com/contoso/Fabrikam/_git/web-app/pullrequest/318/%2e%2e/%2E%2E/%2e./.%2e/evil/_git/x/pullrequest/2",
      "https://dev.azure.com/contoso/Fabrikam/_workitems/edit/1/..",
      "https://dev.azure.com/contoso/Fabrikam/_workitems/edit/1/./x",
      "https://dev.azure.com/contoso/Fabrikam/_boards/board/t/../../../../evil/_boards/board/?workitem=42",
      "https://dev.azure.com/contoso/Fabrikam/_git/web-app/pullrequest/318\\..\\..\\evil",
      "https://contoso.visualstudio.com/Fabrikam/_git/web-app/pullrequest/318/../../../evil/_git/x/pullrequest/2",
      "https://contoso.visualstudio.com/DefaultCollection/Fabrikam/_workitems/edit/1/..?x=1",
    ]) {
      expect(matchIntegrationLink(url), url).toBeNull();
    }
    expect(
      matchIntegrationLink(
        "https://dev.azure.com/contoso/Fabrikam/_git/web-app/pullrequest/318?_a=files&path=/../x",
      )?.match.slice(1),
    ).toEqual(["contoso", "Fabrikam", "web-app", "318"]);
  });

  it("opens a work item from the board, backlog and sprint hubs on both hosts", () => {
    for (const host of ["dev.azure.com/contoso", "contoso.visualstudio.com"]) {
      for (const page of [
        "_boards/board/t/Team/Stories/",
        "_backlogs/backlog/Team/Stories/",
        "_sprints/taskboard/Team/Fabrikam/Sprint%201",
      ]) {
        const url = `https://${host}/Fabrikam/${page}?workitem=42`;
        expect(matchIntegrationLink(url)?.match.slice(1), url).toEqual([
          "contoso",
          "Fabrikam",
          "42",
        ]);
      }
    }
  });

  it("describes links offline with decoded names", () => {
    expect(
      describeIntegrationLink(
        "https://dev.azure.com/contoso/Fabrikam%20Fiber/_workitems/edit/1234",
      ),
    ).toEqual({
      provider: "azure_devops",
      title: "Work Item #1234",
      description: "contoso/Fabrikam Fiber",
    });
    expect(
      describeIntegrationLink(
        "https://dev.azure.com/contoso/Fabrikam/_git/web%20app/pullrequest/318",
      ),
    ).toEqual({
      provider: "azure_devops",
      title: "Pull Request #318",
      description: "contoso/Fabrikam/web app",
    });
    expect(
      describeIntegrationLink(
        "https://dev.azure.com/contoso/_git/Fabrikam/pullrequest/9",
      ),
    ).toEqual({
      provider: "azure_devops",
      title: "Pull Request #9",
      description: "contoso/Fabrikam",
    });
    expect(
      describeIntegrationLink("https://dev.azure.com/contoso/_workitems/edit/7"),
    ).toEqual({
      provider: "azure_devops",
      title: "Work Item #7",
      description: "contoso",
    });
  });

  it("never shows a control, format, separator or slash character taken from the URL", () => {
    const description = (url: string) => describeIntegrationLink(url)?.description;

    for (const escape of [
      "%0A",
      "%00",
      "%7F",
      "%C2%85",
      "%E2%80%AE",
      "%D8%9C",
      "%E2%80%8E",
      "%E2%81%A6",
      "%E2%80%8B",
      "%E2%80%A8",
      "%E2%80%A9",
    ]) {
      expect(
        description(`https://dev.azure.com/contoso/Fab${escape}rikam/_workitems/edit/1`),
        escape,
      ).toBe(`contoso/Fab${escape}rikam`);
    }
    expect(
      description("https://dev.azure.com/contoso/Fabrikam/_git/re%E2%80%AEpo/pullrequest/2"),
    ).toBe("contoso/Fabrikam/re%E2%80%AEpo");
    expect(
      description("https://contoso.visualstudio.com/Fab%E2%80%AErikam/_git/repo/pullrequest/2"),
    ).toBe("contoso/Fab%E2%80%AErikam/repo");
    expect(
      description("https://dev.azure.com/contoso/Fab%ZZ/_workitems/edit/1"),
    ).toBe("contoso/Fab%ZZ");
    expect(
      description("https://dev.azure.com/contoso/Fab\u202erikam/_workitems/edit/1"),
    ).toBe("contoso/Fab%E2%80%AErikam");
    expect(
      description("https://dev.azure.com/contoso/Fabrikam/_git/re\u202epo/pullrequest/2"),
    ).toBe("contoso/Fabrikam/re%E2%80%AEpo");
    expect(
      description("https://dev.azure.com/contoso/Fab\u202e%ZZ/_workitems/edit/1"),
    ).toBe("contoso/Fab%E2%80%AE%ZZ");
    expect(
      description("https://dev.azure.com/contoso/a\u202eb\u202ec/_workitems/edit/1"),
    ).toBe("contoso/a%E2%80%AEb%E2%80%AEc");
    expect(
      description("https://dev.azure.com/contoso/a%2Fb/_workitems/edit/1"),
    ).toBe("contoso/a%2Fb");
    expect(
      description("https://dev.azure.com/contoso/a%2fb/_workitems/edit/1"),
    ).toBe("contoso/a%2fb");
    expect(
      description("https://dev.azure.com/contoso/Caf%C3%A9/_workitems/edit/1"),
    ).toBe("contoso/Caf\u00e9");
    expect(
      description("https://dev.azure.com/contoso/%E6%9D%B1%E4%BA%AC%20Team/_workitems/edit/1"),
    ).toBe("contoso/\u6771\u4eac Team");
  });

  it("stays linear on hostile input", () => {
    const azurePatterns = integrationLinkPatterns.filter(
      (pattern) => pattern.provider === "azure_devops",
    );
    const crafted = [
      "https://dev.azure.com/contoso/Fabrikam/_boards/" + "a&".repeat(20000) + "?" + "x&".repeat(20000) + "\n",
      "https://dev.azure.com/contoso/" + "a/".repeat(30000),
      "https://contoso.visualstudio.com/" + "DefaultCollection/".repeat(5000) + "_git/" + "r".repeat(40000),
      "https://dev.azure.com/contoso/Fabrikam/_sprints/?" + "workitem=&".repeat(20000),
      "https://dev.azure.com/contoso/Fabrikam/_boards/" + "?&".repeat(30000),
      "https://dev.azure.com/contoso/Fabrikam/" + "_git/".repeat(20000),
      "https://dev.azure.com/" + "a".repeat(30000),
      "https://contoso.visualstudio.com/Fabrikam/_boards/" + "a&".repeat(20000) + "?" + "x&".repeat(20000) + "\n",
      "https://contoso.visualstudio.com/Fabrikam/_boards/" + "?&".repeat(30000),
      "https://contoso.visualstudio.com/Fabrikam/_backlogs/?" + "workitem=&".repeat(20000),
      "https://contoso.visualstudio.com/Fabrikam/" + "_git/".repeat(20000),
      "https://" + "a".repeat(30000),
    ];

    expect(azurePatterns).toHaveLength(6);
    for (const input of crafted) {
      const label = `${input.slice(0, 60)}... (${input.length} characters)`;
      const started = performance.now();
      for (const [index, pattern] of azurePatterns.entries()) {
        expect(pattern.regex.test(input), `pattern ${index} on ${label}`).toBe(false);
      }
      expect(performance.now() - started, label).toBeLessThan(100);
    }
  });

  it("sits above the host-agnostic Jira and code host patterns", () => {
    const firstAzure = integrationLinkPatterns.findIndex(
      (pattern) => pattern.provider === "azure_devops",
    );
    const firstJira = integrationLinkPatterns.findIndex(
      (pattern) => pattern.provider === "jira",
    );
    const firstGithub = integrationLinkPatterns.findIndex(
      (pattern) => pattern.provider === "github",
    );
    expect(firstAzure).toBeGreaterThanOrEqual(0);
    expect(firstAzure).toBeLessThan(firstJira);
    expect(firstAzure).toBeLessThan(firstGithub);
    expect(
      matchIntegrationLink("https://dev.azure.com/browse/AB-1/_workitems/edit/5"),
    ).toMatchObject({ provider: "azure_devops", type: "azure-devops-work-item" });
  });
});

describe("Azure DevOps link boundaries on every pattern", () => {
  const azurePatterns = integrationLinkPatterns.filter(
    (pattern) => pattern.provider === "azure_devops",
  );
  const samples = [
    "https://dev.azure.com/contoso/Fabrikam/_git/web-app/pullrequest/318",
    "https://dev.azure.com/contoso/Fabrikam/_workitems/edit/318",
    "https://dev.azure.com/contoso/Fabrikam/_boards/board/t/Team/Stories/?workitem=318",
    "https://contoso.visualstudio.com/Fabrikam/_git/web-app/pullrequest/318",
    "https://contoso.visualstudio.com/Fabrikam/_workitems/edit/318",
    "https://contoso.visualstudio.com/Fabrikam/_boards/board/t/Team/Stories/?workitem=318",
  ];

  it.each(samples.map((url, index): [string, number] => [url, index]))(
    "holds for %s",
    (url, index) => {
      const { regex } = azurePatterns[index];
      expect(regex.test(url)).toBe(true);
      for (const variant of [
        url.replace("https://", "http://"),
        `https://evil.com/?next=${url}`,
        url
          .replace("dev.azure.com", "dev-azure.com")
          .replace("contoso.visualstudio", "contoso-visualstudio"),
        url
          .replace("dev.azure.com", "dev.azure-com")
          .replace("visualstudio.com", "visualstudio-com"),
        url.replace("contoso", "con_toso"),
        url.replace("contoso", "con%2Ftoso"),
        url.replace("contoso", "con.toso"),
        url.replace("Fabrikam", "_Fabrikam"),
        `${url}00000000`,
        `${url}x`,
      ]) {
        expect(regex.test(variant), variant).toBe(false);
      }
    },
  );

  it("accepts the legacy collection segment and a legacy work item without a project", () => {
    expect(
      matchIntegrationLink(
        "https://contoso.visualstudio.com/DefaultCollection/Fabrikam/_git/web-app/pullrequest/318",
      )?.match.slice(1),
    ).toEqual(["contoso", "Fabrikam", "web-app", "318"]);
    expect(
      matchIntegrationLink(
        "https://contoso.visualstudio.com/DefaultCollection/Fabrikam/_boards/board/?workitem=42",
      )?.match.slice(1),
    ).toEqual(["contoso", "Fabrikam", "42"]);
    expect(
      matchIntegrationLink("https://contoso.visualstudio.com/_workitems/edit/7")
        ?.match.slice(1),
    ).toEqual(["contoso", undefined, "7"]);
  });

  it("needs a hub segment and a workitem parameter of its own on board links", () => {
    for (const host of ["dev.azure.com/contoso", "contoso.visualstudio.com"]) {
      expect(
        matchIntegrationLink(`https://${host}/Fabrikam/_boards/board/?xworkitem=42`),
        `${host} with xworkitem`,
      ).toBeNull();
      expect(
        matchIntegrationLink(`https://${host}/Fabrikam/boards/board/?workitem=42`),
        `${host} without the hub underscore`,
      ).toBeNull();
    }
  });

  it("decodes and guards the project of a pull request link", () => {
    const description = (url: string) => describeIntegrationLink(url)?.description;
    expect(
      description("https://dev.azure.com/contoso/Fabrikam%20Fiber/_git/web-app/pullrequest/2"),
    ).toBe("contoso/Fabrikam Fiber/web-app");
    expect(
      description("https://dev.azure.com/contoso/Fab%E2%80%AErikam/_git/web-app/pullrequest/2"),
    ).toBe("contoso/Fab%E2%80%AErikam/web-app");
    expect(
      description("https://dev.azure.com/contoso/Fab\u202erikam/_git/web-app/pullrequest/2"),
    ).toBe("contoso/Fab%E2%80%AErikam/web-app");
  });
});

describe("matchIntegrationLink server parity", () => {
  it("matches a Jira Cloud board link with an uppercase host", () => {
    expect(
      matchIntegrationLink(
        "https://ACME.Atlassian.net/jira/software/projects/AB/boards/1?selectedIssue=AB-12",
        { jira: ["*.atlassian.net"] },
      ),
    ).toMatchObject({ provider: "jira", type: "jira-issue" });
  });

  it("refuses GitLab links with dot segments or a backslash", () => {
    for (const url of [
      "https://gitlab.com/a/b/-/merge_requests/1/../../../../evil/x/-/merge_requests/2",
      "https://gitlab.com/a/b/../../evil/x/-/issues/1",
      "https://gitlab.com/a/b/%2e%2e/evil/x/-/issues/1",
      "https://gitlab.com/a/b/./-/issues/1",
      "https://gitlab.com/a\\b/-/issues/1",
    ]) {
      expect(matchIntegrationLink(url)?.provider).not.toBe("gitlab");
    }
    expect(
      matchIntegrationLink("https://gitlab.com/group/sub.group/-/issues/1"),
    ).toMatchObject({ provider: "gitlab", type: "gitlab-issue" });
  });
});

describe("GitHub, Linear and Jira links with dot segments or a backslash", () => {
  // Each of these matched before the guard; the browser resolves them to a different path.
  it.each([
    "https://github.com/a/b/pull/1/../../../../evil/x/pull/2",
    "https://github.com/../user?x=/pull/1",
    "https://github.com/a/b/pull/1/%2e%2e/%2E%2E/%2e./.%2e/evil/x/pull/2",
    "https://github.com/a/b/pull/1/commits/abc123/../../../../../evil/x/pull/2",
    "https://github.com/a/b/issues/1/..",
    "https://github.com/a/b/issues/1/..?x=1",
    "https://github.com/a/b/commit/abc123/./x",
    "https://github.com/a/b/blob/main/../../../evil/x/blob/main/secret.txt",
    "https://github.com/a/b/pulls/../../evil/x/pulls",
    "https://github.com/a/b/releases/./tag/v1",
    "https://github.com/a/b/issues/created_by/../../../evil/x/issues",
    "https://github.com/a/b/pull/1\\..\\..\\evil",
    "https://github.com/a\\b/c/pull/1",
    "https://linear.app/acme/issue/ABC-1/../../../evil/issue/XYZ-2",
    "https://linear.app/acme/issue/ABC-1/%2e%2e/%2E%2e/%2e./evil/issue/XYZ-2",
    "https://linear.app/acme/issue/ABC-1/slug/..",
    "https://linear.app/acme/project/p/../../../evil/project/q",
    "https://linear.app/acme/initiative/i\\..\\..\\evil",
    "https://linear.app/./view/v1",
    "https://linear.app/acme/view/v1/.",
    "https://linear.app/acme/view/v1/..?x=1",
    "https://acme.atlassian.net/browse/AB-1/../../browse/EVIL-2",
    "https://acme.atlassian.net/browse/AB-1/%2e%2e/%2E%2e/browse/EVIL-2",
    "https://acme.atlassian.net/browse/AB-1/.?x=1",
    "https://acme.atlassian.net/browse/AB-1\\..\\..\\browse\\EVIL-2",
    "https://acme.jira.com/browse/AB-1/..",
    "https://evil.com\\@acme.atlassian.net/browse/AB-1",
    "https://jira.acme.com/browse/AB-1/../../browse/EVIL-2",
    "https://jira.acme.com/browse/AB-1/%2E%2E/%2E%2E/browse/EVIL-2",
  ])("matches no provider for %s", (url) => {
    expect(matchIntegrationLink(url)).toBeNull();
  });

  it.each([
    ["https://github.com/o/.github/pull/1", "github-pr", ["o", ".github", "1"]],
    ["https://github.com/o/my..repo/issues/2", "github-issue", ["o", "my..repo", "2"]],
    ["https://github.com/o/.../issues/3", "github-issue", ["o", "...", "3"]],
    ["https://github.com/o/r/pull/1#discussion_r1/../..", "github-pr", ["o", "r", "1"]],
    ["https://github.com/o/r/pulls?q=../../x", "github-pulls-list", ["o", "r"]],
    [
      "https://github.com/o/r/blob/main/.github/workflows/ci.yml#L1-L3",
      "github-file",
      ["o", "r", "main", ".github/workflows/ci.yml", "1", "3"],
    ],
    [
      "https://github.com/o/r/blob/main/src/..hidden/a.ts",
      "github-file",
      ["o", "r", "main", "src/..hidden/a.ts", undefined, undefined],
    ],
    ["https://linear.app/acme/issue/ABC-1/fix-the-login", "linear-issue", ["acme", "ABC-1", "fix-the-login"]],
    ["https://linear.app/acme/issue/ABC-1#comment-1/../..", "linear-issue", ["acme", "ABC-1", undefined]],
    ["https://linear.app/acme/issue/ABC-1?q=../..", "linear-issue", ["acme", "ABC-1", undefined]],
    ["https://linear.app/acme/view/..x", "linear-view", ["acme", "..x"]],
    ["https://acme.atlassian.net/browse/AB-1?atlOrigin=x/../..", "jira-issue", ["AB-1"]],
    ["https://acme.atlassian.net/browse/AB-1#comment-../..", "jira-issue", ["AB-1"]],
    [
      "https://acme.atlassian.net/secure/RapidBoard.jspa?rapidView=1&x=../..&selectedIssue=AB-1",
      "jira-issue",
      ["AB-1"],
    ],
    [
      "https://acme.atlassian.net/jira/software/c/projects/AB/boards/1/backlog?x=../..&selectedIssue=AB-1",
      "jira-issue",
      ["AB-1"],
    ],
    ["https://jira.acme.com/browse/AB-1?x=../..", "jira-issue", ["AB-1"]],
  ])("still matches %s as %s", (url, type, groups) => {
    const matched = matchIntegrationLink(url);
    expect(matched?.type).toBe(type);
    expect(matched?.match.slice(1)).toEqual(groups);
  });

  it("guards a GitHub Enterprise host the same way", () => {
    const hosts = { github: ["github.acme.com"] };
    expect(
      matchIntegrationLink(
        "https://github.acme.com/a/b/pull/1/../../../../evil/x/pull/2",
        hosts,
      ),
    ).toBeNull();
    expect(
      matchIntegrationLink("https://github.acme.com/o/r/pull/1", hosts),
    ).toMatchObject({ provider: "github", type: "github-pr" });
  });
});

describe("GitHub owner and repo segments", () => {
  // The browser opens the repo or owner for these; the rest of the route is query or fragment.
  it.each([
    "https://github.com/o/r?x=/pull/1",
    "https://github.com/o/r#x/pull/1",
    "https://github.com/o?x=/r/issues/1",
    "https://github.com/o/r?/commit/abc123",
    "https://github.com/o/r?x=/pull/1/commits/abc123",
    "https://github.com/o/r#/blob/main/a.ts",
    "https://github.com/o/r?x=/pulls",
    "https://github.com/o/r#/releases",
    "https://github.com/o/r?x=/issues",
  ])("matches no provider for %s", (url) => {
    expect(matchIntegrationLink(url)).toBeNull();
    expect(describeIntegrationLink(url)).toBeNull();
  });

  it("refuses the same on a GitHub Enterprise host and an unknown host", () => {
    expect(
      matchIntegrationLink("https://github.acme.com/o/r?x=/pull/1", {
        github: ["github.acme.com"],
      }),
    ).toBeNull();
    expect(
      matchIntegrationLink("https://code.example.com/o/r?x=/pull/1"),
    ).toBeNull();
  });

  it("captures owners and repos with dots, dashes and underscores", () => {
    expect(
      matchIntegrationLink("https://github.com/my-org_1/repo.name-x/pull/1")
        ?.match.slice(1),
    ).toEqual(["my-org_1", "repo.name-x", "1"]);
  });
});

describe("Jira Data Center under a context path", () => {
  const hosts = { jira: ["jira.acme.com"] };

  it.each([
    "https://jira.acme.com/jira/browse/AB-1",
    "https://jira.acme.com/tools/jira/browse/AB-1",
    "https://jira.acme.com/jira/browse/AB-1?focusedCommentId=1&x=../..",
    "https://jira.acme.com/jira/browse/AB-1#comment-../..",
    "https://jira.acme.com/jira/secure/RapidBoard.jspa?rapidView=1&selectedIssue=AB-1",
  ])("matches %s on an installed Jira host", (url) => {
    const matched = matchIntegrationLink(url, hosts);
    expect(matched).toMatchObject({ provider: "jira", type: "jira-issue" });
    expect(matched?.match.slice(1)).toEqual(["AB-1"]);
  });

  it("takes the first issue key after the context path", () => {
    expect(
      matchIntegrationLink(
        "https://jira.acme.com/jira/browse/AB-1/browse/CD-2",
        hosts,
      )?.match[1],
    ).toBe("AB-1");
  });

  it.each([
    "https://jira.acme.com/jira/browse/AB-1",
    "https://jira.acme.com/jira/secure/RapidBoard.jspa?selectedIssue=AB-1",
    "https://blog.example.com/posts/browse/AB-1",
  ])("does not match %s without an installed Jira host", (url) => {
    expect(matchIntegrationLink(url)).toBeNull();
    expect(matchIntegrationLink(url, {})).toBeNull();
    expect(matchIntegrationLink(url, { github: ["github.com"] })).toBeNull();
    expect(
      matchIntegrationLink(url, { jira: ["*.atlassian.net", "*.jira.com"] }),
    ).toBeNull();
    expect(matchIntegrationLink(url, { jira: ["jira.other.com"] })).toBeNull();
  });

  it.each([
    "https://jira.acme.com/jira/../browse/AB-1",
    "https://jira.acme.com/x/../jira/browse/AB-1",
    "https://jira.acme.com/jira/%2e%2e/browse/AB-1",
    "https://jira.acme.com/jira/%2E%2E/%2e./browse/AB-1",
    "https://jira.acme.com/jira/./browse/AB-1",
    "https://jira.acme.com/jira/browse/AB-1/../../../browse/EVIL-2",
    "https://jira.acme.com/jira\\..\\browse/AB-1",
    "https://jira.acme.com/jira/../secure/RapidBoard.jspa?selectedIssue=AB-1",
  ])("refuses %s, which the browser resolves elsewhere", (url) => {
    expect(matchIntegrationLink(url, hosts)).toBeNull();
  });

  it("stays linear on a crafted context path", () => {
    const contextPathPatterns = integrationLinkPatterns.filter(
      (pattern) => pattern.requiresProviderHost,
    );
    const crafted = [
      "https://jira.acme.com" + "/a".repeat(20000) + "/browse/x",
      "https://jira.acme.com" + "/a".repeat(20000) + "/secure/RapidBoard.jspa?" + "x&".repeat(10000),
      "https://jira.acme.com" + "/.a".repeat(20000) + "/..",
    ];

    expect(contextPathPatterns).toHaveLength(2);
    for (const input of crafted) {
      const started = performance.now();
      for (const pattern of contextPathPatterns) {
        expect(pattern.regex.test(input)).toBe(false);
      }
      expect(performance.now() - started).toBeLessThan(100);
    }
  });
});
