import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { notifications } from "@mantine/notifications";
import {
  submitForApproval,
  verifyPage,
} from "@/ee/page-verification/services/page-verification-service";
import { invalidatePageInfo } from "@/features/page/queries/page-query";
import {
  useSubmitForApprovalMutation,
  useVerifyPageMutation,
} from "./page-verification-query";

vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  verifyPage: vi.fn(),
  submitForApproval: vi.fn(),
}));

vi.mock("@/features/page/queries/page-query", () => ({
  invalidatePageInfo: vi.fn(),
}));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const queryClient = new QueryClient();
const invalidate = vi.spyOn(queryClient, "invalidateQueries");

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const invalidatedKeys = () =>
  invalidate.mock.calls.map(([filters]) => filters?.queryKey);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useVerifyPageMutation", () => {
  it("approves the submission the approver reviewed and refreshes the page", async () => {
    vi.mocked(verifyPage).mockResolvedValue();
    const { result } = renderHook(() => useVerifyPageMutation(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ pageId: "page-1", pendingHistoryId: "h-1" }),
    );

    expect(verifyPage).toHaveBeenCalledWith({
      pageId: "page-1",
      pendingHistoryId: "h-1",
    });
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([
        ["page-verification-info", "page-1"],
        ["page-history-list", "page-1"],
        ["verification-list"],
      ]),
    );
    expect(invalidatePageInfo).toHaveBeenCalledWith("page-1");
  });

  it("refetches and says so when the submission changed after it was opened", async () => {
    vi.mocked(verifyPage).mockRejectedValue({
      response: { status: 409, data: { message: "Submission is not pending" } },
    });
    const { result } = renderHook(() => useVerifyPageMutation(), { wrapper });

    await act(() =>
      result.current
        .mutateAsync({ pageId: "page-1", pendingHistoryId: "h-1" })
        .catch(() => undefined),
    );

    expect(notifications.show).toHaveBeenCalledWith({
      message: "This submission changed. Review the new version.",
      color: "red",
    });
    expect(invalidatedKeys()).toContainEqual(["page-verification-info", "page-1"]);
    expect(invalidatePageInfo).toHaveBeenCalledWith("page-1");
  });

  it("shows the server message for other failures", async () => {
    vi.mocked(verifyPage).mockRejectedValue({
      response: { status: 403, data: { message: "Not an approver" } },
    });
    const { result } = renderHook(() => useVerifyPageMutation(), { wrapper });

    await act(() =>
      result.current
        .mutateAsync({ pageId: "page-1", pendingHistoryId: "h-1" })
        .catch(() => undefined),
    );

    expect(notifications.show).toHaveBeenCalledWith({
      message: "Not an approver",
      color: "red",
    });
    expect(invalidatePageInfo).not.toHaveBeenCalled();
  });
});

describe("useSubmitForApprovalMutation", () => {
  it("sends the change summary and refreshes the page", async () => {
    vi.mocked(submitForApproval).mockResolvedValue();
    const { result } = renderHook(() => useSubmitForApprovalMutation(), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({
        pageId: "page-1",
        changeSummary: "Updated torque values",
      }),
    );

    expect(submitForApproval).toHaveBeenCalledWith({
      pageId: "page-1",
      changeSummary: "Updated torque values",
    });
    expect(invalidatePageInfo).toHaveBeenCalledWith("page-1");
  });
});
