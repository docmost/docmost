import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./app-route";

describe("safeRedirectPath", () => {
  it.each([
    "/.//evil.example",
    "/..//evil.example",
    "/././/evil.example",
    "/%2e//evil.example",
    "/a/..//evil.example",
  ])("rejects %s, which resolves to a protocol-relative path", (input) => {
    expect(safeRedirectPath(input)).toBeNull();
  });

  it("keeps a same-origin path with its query and hash", () => {
    expect(safeRedirectPath("/s/general/p/abc?x=1#h")).toBe(
      "/s/general/p/abc?x=1#h",
    );
  });

  it("normalizes dot segments in an ordinary path", () => {
    expect(safeRedirectPath("/a/./b/../c")).toBe("/a/c");
  });
});
