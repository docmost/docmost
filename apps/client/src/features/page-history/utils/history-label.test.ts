import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { getHistoryLabel } from "./history-label";

const t = ((key: string, vars?: Record<string, unknown>) =>
  key.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    String(vars?.[name]),
  )) as unknown as TFunction;

const approver = { id: "u1", name: "Ada", avatarUrl: "" };

describe("getHistoryLabel", () => {
  it("names the version and the approver of an approved row", () => {
    expect(
      getHistoryLabel(
        { kind: "approved", version: 3, changeSummary: null, approvedBy: approver },
        t,
      ),
    ).toBe("Version 3 · Approved by Ada");
  });

  it("drops the approver when the account no longer exists", () => {
    expect(
      getHistoryLabel(
        { kind: "approved", version: 3, changeSummary: null, approvedBy: null },
        t,
      ),
    ).toBe("Version 3 · Approved");
  });

  it("labels baselines", () => {
    expect(
      getHistoryLabel(
        { kind: "baseline", version: null, changeSummary: null, approvedBy: null },
        t,
      ),
    ).toBe("Baseline");
  });

  it("labels draft snapshots only when they are submissions", () => {
    expect(
      getHistoryLabel(
        { kind: "draft", version: null, changeSummary: "Fixed torque", approvedBy: null },
        t,
      ),
    ).toBe("Submitted for approval");
    expect(
      getHistoryLabel(
        { kind: "draft", version: null, changeSummary: null, approvedBy: null },
        t,
      ),
    ).toBeNull();
  });

  it("leaves regular history rows unlabelled", () => {
    expect(
      getHistoryLabel(
        { kind: null, version: null, changeSummary: null, approvedBy: null },
        t,
      ),
    ).toBeNull();
  });
});
