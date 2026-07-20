import { describe, it, expect } from "vitest";
import { getReviewUrlOverride } from "./notification-url-override";

describe("getReviewUrlOverride", () => {
  it("returns a /review/:pageId url for review-eligible notification types", () => {
    const notification = {
      type: "page.approval_requested",
      page: { id: "p1", slugId: "abc", title: "Doc" },
    } as any;

    expect(getReviewUrlOverride(notification)).toBe("/review/p1");
  });

  it("returns undefined for unrelated notification types", () => {
    const notification = { type: "page.updated", page: { id: "p1" } } as any;
    expect(getReviewUrlOverride(notification)).toBeUndefined();
  });

  it("returns undefined when the notification has no page", () => {
    const notification = { type: "page.approval_requested", page: null } as any;
    expect(getReviewUrlOverride(notification)).toBeUndefined();
  });
});
