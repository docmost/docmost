import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  default: {
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import {
  approveReview,
  getReviewPayload,
  rejectReview,
  requestClarification,
  submitForReview,
} from "@/ee/page-verification/services/page-verification-service";

describe("page-verification-service review workflow", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it("submitForReview posts to /pages/submit-for-review with pageId", async () => {
    postMock.mockResolvedValueOnce({ data: undefined });

    await submitForReview("page-1");

    expect(postMock).toHaveBeenCalledWith("/pages/submit-for-review", {
      pageId: "page-1",
    });
  });

  it("approveReview posts to /pages/approve-review with pageId", async () => {
    postMock.mockResolvedValueOnce({ data: undefined });

    await approveReview("page-1");

    expect(postMock).toHaveBeenCalledWith("/pages/approve-review", {
      pageId: "page-1",
    });
  });

  it("rejectReview posts to /pages/reject-review with pageId and comment", async () => {
    postMock.mockResolvedValueOnce({ data: undefined });

    await rejectReview({ pageId: "page-1", comment: "needs fixes" });

    expect(postMock).toHaveBeenCalledWith("/pages/reject-review", {
      pageId: "page-1",
      comment: "needs fixes",
    });
  });

  it("requestClarification posts to /pages/request-clarification with pageId", async () => {
    postMock.mockResolvedValueOnce({ data: undefined });

    await requestClarification("page-1");

    expect(postMock).toHaveBeenCalledWith("/pages/request-clarification", {
      pageId: "page-1",
    });
  });

  it("getReviewPayload posts to /pages/review-payload and returns response data", async () => {
    const payload = {
      verification: { status: "in_approval" },
      reviews: [],
      permissions: { isReviewer: true },
    };
    postMock.mockResolvedValueOnce({ data: payload });

    const result = await getReviewPayload("page-1");

    expect(postMock).toHaveBeenCalledWith("/pages/review-payload", {
      pageId: "page-1",
    });
    expect(result).toEqual(payload);
  });
});
