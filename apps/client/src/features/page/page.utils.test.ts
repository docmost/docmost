import { describe, expect, it } from "vitest";
import { extractPageSlugId } from "@/lib";
import { buildPageUrl } from "./page.utils";

describe("buildPageUrl", () => {
  it("joins the title slug and the slugId", () => {
    expect(buildPageUrl("docs", "x7Kd91mQa0", "Release notes")).toBe(
      "/s/docs/p/release-notes-x7Kd91mQa0",
    );
  });

  it.each(["发布说明", "הערות", "บันทึก"])(
    "uses the bare slugId when the title %s has no latin slug",
    (title) => {
      expect(buildPageUrl("docs", "x7Kd91mQa0", title)).toBe(
        "/s/docs/p/x7Kd91mQa0",
      );
    },
  );
});

describe("extractPageSlugId", () => {
  it.each([
    "release-notes-x7Kd91mQa0",
    "x7Kd91mQa0",
    // urls built before the title slug could be empty
    "-x7Kd91mQa0",
  ])("reads the slugId from %s", (slug) => {
    expect(extractPageSlugId(slug)).toBe("x7Kd91mQa0");
  });
});
