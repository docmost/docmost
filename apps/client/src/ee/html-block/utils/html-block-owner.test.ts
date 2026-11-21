import { describe, expect, it } from "vitest";
import { isOwnedByTarget } from "./html-block-owner";

describe("isOwnedByTarget", () => {
  it("matches the owner page or template against the editor's target", () => {
    const onPage1 = { pageId: "page-1", templateId: null };
    const inTemplate1 = { pageId: null, templateId: "template-1" };

    expect(isOwnedByTarget(onPage1, { pageId: "page-1" })).toBe(true);
    expect(isOwnedByTarget(onPage1, { pageId: "page-2" })).toBe(false);
    expect(isOwnedByTarget(onPage1, { templateId: "template-1" })).toBe(false);
    expect(isOwnedByTarget(inTemplate1, { templateId: "template-1" })).toBe(
      true,
    );
    expect(isOwnedByTarget(inTemplate1, { templateId: "template-2" })).toBe(
      false,
    );
    expect(isOwnedByTarget(inTemplate1, { pageId: "page-1" })).toBe(false);
  });

  it("treats a version whose owner is unknown as not owned", () => {
    expect(isOwnedByTarget(undefined, { pageId: "page-1" })).toBe(false);
    expect(isOwnedByTarget(null, { templateId: "template-1" })).toBe(false);
  });
});
