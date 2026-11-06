import { describe, expect, it } from "vitest";
import { normalizeHistoryTitle } from "./normalize-history-title";

describe("normalizeHistoryTitle", () => {
  it("collapses whitespace like the change detection", () => {
    expect(normalizeHistoryTitle("  Release  notes \n v2 ")).toBe(
      "Release notes v2",
    );
  });

  it("treats a missing title as empty", () => {
    expect(normalizeHistoryTitle(null)).toBe("");
    expect(normalizeHistoryTitle(undefined)).toBe("");
  });
});
