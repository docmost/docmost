import { describe, expect, it } from "vitest";
import { isReaderOfControlledPage } from "./page.utils";

const approval = (overrides: Record<string, boolean>) => ({
  approval: {
    controlled: true,
    canAccessDraft: false,
    unpublished: false,
    ...overrides,
  },
});

describe("isReaderOfControlledPage", () => {
  it("is true for a controlled page without draft access", () => {
    expect(isReaderOfControlledPage(approval({}))).toBe(true);
  });

  it("is false for users with draft access", () => {
    expect(isReaderOfControlledPage(approval({ canAccessDraft: true }))).toBe(
      false,
    );
  });

  it("is false for pages that are not controlled or carry no approval info", () => {
    expect(isReaderOfControlledPage(approval({ controlled: false }))).toBe(
      false,
    );
    expect(isReaderOfControlledPage({})).toBe(false);
    expect(isReaderOfControlledPage(undefined)).toBe(false);
  });
});
