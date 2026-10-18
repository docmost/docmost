import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import type { IPageApproval } from "@/features/page/types/page.types";
import type {
  ILatestReaderVersion,
  IPageVerificationInfo,
} from "@/ee/page-verification/types/page-verification.types";
import {
  getApprovalBannerModel,
  getReaderBadgeLabel,
  hasSubmittableChanges,
} from "./approval-state";

const t = ((key: string, options?: Record<string, unknown>) =>
  key.replace(/{{(\w+)}}/g, (_, name) =>
    String(options?.[name] ?? ""),
  )) as unknown as TFunction;

const approval = (overrides: Partial<IPageApproval> = {}): IPageApproval => ({
  controlled: true,
  canAccessDraft: true,
  locked: false,
  unpublished: false,
  ...overrides,
});

const approvedVersion: ILatestReaderVersion = {
  id: "v-3",
  kind: "approved",
  number: 3,
  approvedAt: "2026-10-12T09:00:00Z",
  approvedBy: { id: "u-1", name: "Ada", avatarUrl: null },
};

const baselineVersion: ILatestReaderVersion = {
  id: "v-0",
  kind: "baseline",
  number: null,
  approvedAt: null,
  approvedBy: null,
};

const info = (
  overrides: Partial<IPageVerificationInfo> = {},
): IPageVerificationInfo => ({
  status: "approved",
  latestReaderVersion: approvedVersion,
  hasDraftChanges: false,
  ...overrides,
});

describe("getApprovalBannerModel", () => {
  it("shows nothing on an uncontrolled page", () => {
    expect(
      getApprovalBannerModel(
        approval({ controlled: false }),
        info({ hasDraftChanges: true }),
      ),
    ).toBeNull();
    expect(getApprovalBannerModel(undefined, info())).toBeNull();
  });

  it("shows nothing to a reader", () => {
    expect(
      getApprovalBannerModel(
        approval({ canAccessDraft: false }),
        info({ status: "in_approval" }),
      ),
    ).toBeNull();
  });

  it("waits for the verification info", () => {
    expect(getApprovalBannerModel(approval(), undefined)).toBeNull();
  });

  it("tells editors an unpublished page is invisible to readers", () => {
    const model = getApprovalBannerModel(
      approval({ unpublished: true }),
      info({
        status: "draft",
        latestReaderVersion: null,
        hasDraftChanges: true,
      }),
    );

    expect(model).toEqual({ returned: null, state: { kind: "unpublished" } });
  });

  it("points to the version readers see while the draft has changes", () => {
    const model = getApprovalBannerModel(
      approval(),
      info({ hasDraftChanges: true }),
    );

    expect(model?.state).toEqual({
      kind: "changes",
      version: approvedVersion,
    });
  });

  it("describes a baseline, which has no version number, the same way", () => {
    const model = getApprovalBannerModel(
      approval(),
      info({
        status: "draft",
        latestReaderVersion: baselineVersion,
        hasDraftChanges: true,
      }),
    );

    expect(model?.state).toEqual({
      kind: "changes",
      version: baselineVersion,
    });
  });

  it("shows no banner when the draft matches what readers see", () => {
    expect(getApprovalBannerModel(approval(), info())).toBeNull();
  });

  it("shows the review state whatever the draft holds", () => {
    const model = getApprovalBannerModel(
      approval({ locked: true }),
      info({ status: "in_approval", hasDraftChanges: true }),
    );

    expect(model?.state).toEqual({ kind: "in_review" });
  });

  it("keeps the review state for a first submission", () => {
    const model = getApprovalBannerModel(
      approval({ unpublished: true, locked: true }),
      info({ status: "in_approval", latestReaderVersion: null }),
    );

    expect(model?.state).toEqual({ kind: "in_review" });
  });

  it("names the version readers keep seeing on an obsolete page", () => {
    const model = getApprovalBannerModel(
      approval({ locked: true }),
      info({ status: "obsolete" }),
    );

    expect(model?.state).toEqual({
      kind: "obsolete",
      version: approvedVersion,
    });
  });

  it("puts the returned notice above the draft banner", () => {
    const model = getApprovalBannerModel(
      approval(),
      info({
        status: "draft",
        hasDraftChanges: true,
        requestedAt: "2026-10-17T10:00:00Z",
        rejectedAt: "2026-10-17T11:00:00Z",
        rejectedBy: { id: "u-2", name: "Grace", avatarUrl: null },
        rejectionComment: "Fix the torque values",
      }),
    );

    expect(model).toEqual({
      returned: { by: { id: "u-2", name: "Grace", avatarUrl: null }, comment: "Fix the torque values" },
      state: { kind: "changes", version: approvedVersion },
    });
  });

  it("drops the returned notice once a newer submission replaced it", () => {
    const model = getApprovalBannerModel(
      approval(),
      info({
        status: "draft",
        hasDraftChanges: true,
        requestedAt: "2026-10-18T10:00:00Z",
        rejectedAt: "2026-10-17T11:00:00Z",
        rejectedBy: { id: "u-2", name: "Grace", avatarUrl: null },
      }),
    );

    expect(model?.returned).toBeNull();
  });

  it("only reports a return while the page is a draft", () => {
    const model = getApprovalBannerModel(
      approval(),
      info({
        status: "approved",
        hasDraftChanges: true,
        rejectedAt: "2026-10-17T11:00:00Z",
        rejectedBy: { id: "u-2", name: "Grace", avatarUrl: null },
      }),
    );

    expect(model?.returned).toBeNull();
  });

});

// What the server answers for a controlled page in an approval space that has no approval row yet.
const rowLess = (
  overrides: Partial<IPageVerificationInfo> = {},
): IPageVerificationInfo => ({
  id: null,
  type: "qms",
  status: "draft",
  source: "space",
  spaceRequiresApproval: true,
  verifiers: [],
  latestReaderVersion: baselineVersion,
  hasDraftChanges: false,
  requestedAt: null,
  rejectedAt: null,
  ...overrides,
});

describe("getApprovalBannerModel for a page without an approval row", () => {
  it("tells editors a new page is invisible to readers", () => {
    const model = getApprovalBannerModel(
      approval({ unpublished: true }),
      rowLess({ latestReaderVersion: null, hasDraftChanges: true }),
    );

    expect(model).toEqual({ returned: null, state: { kind: "unpublished" } });
  });

  it("points to the baseline readers see while the draft has changes", () => {
    const model = getApprovalBannerModel(
      approval(),
      rowLess({ hasDraftChanges: true }),
    );

    expect(model).toEqual({
      returned: null,
      state: { kind: "changes", version: baselineVersion },
    });
  });

  it("shows nothing while the draft matches the baseline", () => {
    expect(getApprovalBannerModel(approval(), rowLess())).toBeNull();
  });
});

describe("hasSubmittableChanges", () => {
  it("needs a difference once readers have a version", () => {
    expect(hasSubmittableChanges(info({ hasDraftChanges: false }))).toBe(false);
    expect(hasSubmittableChanges(info({ hasDraftChanges: true }))).toBe(true);
  });

  it("always lets a page without a reader version be submitted", () => {
    expect(
      hasSubmittableChanges(
        info({ latestReaderVersion: null, hasDraftChanges: false }),
      ),
    ).toBe(true);
  });
});

describe("getReaderBadgeLabel", () => {
  it("shows the approved version number", () => {
    expect(
      getReaderBadgeLabel(
        {
          status: "approved",
          readerVersion: {
            number: 4,
            approvedAt: "2026-10-12T09:00:00Z",
            approvedBy: null,
          },
        },
        t,
      ),
    ).toBe("Approved · v4");
  });

  it("falls back to a plain label without a number", () => {
    expect(
      getReaderBadgeLabel({ status: "approved", readerVersion: null }, t),
    ).toBe("Approved");
  });

  it("labels a baseline and an obsolete page", () => {
    expect(getReaderBadgeLabel({ status: "not_approved" }, t)).toBe(
      "Not yet approved",
    );
    expect(getReaderBadgeLabel({ status: "obsolete" }, t)).toBe("Obsolete");
  });

  it("has no label for statuses readers never receive", () => {
    expect(getReaderBadgeLabel({ status: "draft" }, t)).toBe("");
  });
});
