import { describe, expect, it } from "vitest";
import {
  canReviewChanges,
  containsDiagram,
  normalizeReviewTitle,
} from "./page-verification.utils";
import { IPageVerificationInfo } from "./types/page-verification.types";

const info = (
  overrides: Partial<IPageVerificationInfo>,
): IPageVerificationInfo => ({
  status: "none",
  verifiedHistoryId: null,
  rejectedHistoryId: null,
  ...overrides,
});

describe("canReviewChanges", () => {
  describe("recurring verification", () => {
    it("is offered after unverified changes", () => {
      expect(
        canReviewChanges(
          info({
            type: "expiring",
            status: "invalidated",
            verifiedHistoryId: "v1",
          }),
        ),
      ).toBe(true);
    });

    it("is offered after the verification expired", () => {
      expect(
        canReviewChanges(
          info({ type: "expiring", status: "expired", verifiedHistoryId: "v1" }),
        ),
      ).toBe(true);
    });

    it("is not offered while verified or expiring soon", () => {
      expect(
        canReviewChanges(
          info({
            type: "expiring",
            status: "verified",
            verifiedHistoryId: "v1",
          }),
        ),
      ).toBe(false);
      expect(
        canReviewChanges(
          info({
            type: "expiring",
            status: "expiring",
            verifiedHistoryId: "v1",
          }),
        ),
      ).toBe(false);
    });

    it("needs a verified version", () => {
      expect(
        canReviewChanges(info({ type: "expiring", status: "invalidated" })),
      ).toBe(false);
      expect(
        canReviewChanges(info({ type: "expiring", status: "expired" })),
      ).toBe(false);
    });

    it("does not count a rejected version", () => {
      expect(
        canReviewChanges(
          info({
            type: "expiring",
            status: "invalidated",
            rejectedHistoryId: "r1",
          }),
        ),
      ).toBe(false);
    });
  });

  describe("approval workflow", () => {
    it("is offered for drafts and pages in approval with an approved version", () => {
      expect(
        canReviewChanges(
          info({ type: "qms", status: "draft", verifiedHistoryId: "v1" }),
        ),
      ).toBe(true);
      expect(
        canReviewChanges(
          info({ type: "qms", status: "in_approval", verifiedHistoryId: "v1" }),
        ),
      ).toBe(true);
    });

    it("is offered with only a rejected version", () => {
      expect(
        canReviewChanges(
          info({ type: "qms", status: "draft", rejectedHistoryId: "r1" }),
        ),
      ).toBe(true);
      expect(
        canReviewChanges(
          info({ type: "qms", status: "in_approval", rejectedHistoryId: "r1" }),
        ),
      ).toBe(true);
    });

    it("is not offered for approved or obsolete pages", () => {
      const pointers = { verifiedHistoryId: "v1", rejectedHistoryId: "r1" };
      expect(
        canReviewChanges(info({ type: "qms", status: "approved", ...pointers })),
      ).toBe(false);
      expect(
        canReviewChanges(info({ type: "qms", status: "obsolete", ...pointers })),
      ).toBe(false);
    });

    it("needs an approved or rejected version", () => {
      expect(canReviewChanges(info({ type: "qms", status: "draft" }))).toBe(
        false,
      );
      expect(
        canReviewChanges(info({ type: "qms", status: "in_approval" })),
      ).toBe(false);
    });
  });

  it("is not offered without a verification", () => {
    expect(canReviewChanges(undefined)).toBe(false);
    expect(canReviewChanges(info({ status: "none" }))).toBe(false);
  });
});

describe("containsDiagram", () => {
  it("finds draw.io and Excalidraw nodes at any depth", () => {
    expect(
      containsDiagram({
        type: "doc",
        content: [
          {
            type: "details",
            content: [
              { type: "paragraph" },
              { type: "detailsContent", content: [{ type: "drawio" }] },
            ],
          },
        ],
      }),
    ).toBe(true);
    expect(
      containsDiagram({ type: "doc", content: [{ type: "excalidraw" }] }),
    ).toBe(true);
  });

  it("is false for documents without diagrams", () => {
    expect(
      containsDiagram({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "drawio" }] },
          { type: "image" },
        ],
      }),
    ).toBe(false);
    expect(containsDiagram(undefined)).toBe(false);
  });
});

describe("normalizeReviewTitle", () => {
  it("collapses whitespace like the change detection", () => {
    expect(normalizeReviewTitle("  Release  notes \n v2 ")).toBe(
      "Release notes v2",
    );
  });

  it("treats a missing title as empty", () => {
    expect(normalizeReviewTitle(null)).toBe("");
  });
});
