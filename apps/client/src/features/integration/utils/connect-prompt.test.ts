import { describe, expect, it } from "vitest";
import { resolveConnectPrompt } from "./connect-prompt";

const slack = { type: "slack", name: "Slack", capabilities: ["oauth", "unfurl"] } as any;
const github = { type: "github", name: "GitHub", capabilities: ["oauth", "unfurl"] } as any;
const installed = [{ id: "i-slack", type: "slack" }] as any;

describe("resolveConnectPrompt", () => {
  it("returns nothing without a connect parameter", () => {
    expect(resolveConnectPrompt(null, [slack], installed, [])).toBeNull();
  });

  it("returns nothing for a provider that is not installed", () => {
    expect(resolveConnectPrompt("github", [slack, github], installed, [])).toBeNull();
  });

  it("returns nothing when the user already has a live connection", () => {
    const live = [{ type: "slack", invalidatedAt: null }] as any;
    expect(resolveConnectPrompt("slack", [slack], installed, live)).toBeNull();
  });

  it("prompts when the user is unlinked", () => {
    expect(resolveConnectPrompt("slack", [slack], installed, [])).toBe(slack);
  });

  it("prompts when the existing connection is invalidated", () => {
    const dead = [{ type: "slack", invalidatedAt: "2026-09-01T00:00:00Z" }] as any;
    expect(resolveConnectPrompt("slack", [slack], installed, dead)).toBe(slack);
  });
});
