import { act, renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Provider } from "jotai";
import type { PropsWithChildren } from "react";
import { expect, it, vi } from "vitest";
import { usePageEditMode } from "./use-page-edit-mode";
import { PageEditMode } from "@/features/user/types/user.types";

const { request, feature } = vi.hoisted(() => ({
  request: vi.fn(),
  feature: vi.fn(() => true),
}));
vi.mock("@/ee/hooks/use-feature", () => ({ useHasFeature: feature }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (v: string) => v }),
}));
vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  getVerificationInfo: request,
}));
vi.mock("@/main.tsx", () => ({}));

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return renderHook(() => usePageEditMode("scratchpad"), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>
        <Provider>{children}</Provider>
      </QueryClientProvider>
    ),
  });
}

it.each(["none", "verified"] as const)(
  "holds editing through an outage and a pending retry, then honors %s",
  async (status) => {
    feature.mockReturnValue(true);
    let finish!: (status: { status: string }) => void;
    request
      .mockReset()
      .mockRejectedValueOnce(new Error("503"))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    const { result, unmount } = mount();
    await waitFor(() =>
      expect(result.current.verificationUnavailable).toBe(true),
    );
    expect(result.current.isCheckingLock).toBe(true);
    act(() => {
      void result.current.retryVerification();
    });
    await waitFor(() => expect(result.current.retryingVerification).toBe(true));
    expect(result.current.verificationUnavailable).toBe(true);
    expect(result.current.isCheckingLock).toBe(true);
    await act(async () => finish({ status }));
    await waitFor(() => expect(result.current.isCheckingLock).toBe(false));
    expect(result.current.verificationUnavailable).toBe(false);
    expect(result.current.isLocked).toBe(status === "verified");
    if (status === "verified")
      expect(result.current.editMode).toBe(PageEditMode.Read);
    expect(request).toHaveBeenCalledTimes(2);
    unmount();
  },
);

it("leaves pages editable without a verification feature or request", () => {
  feature.mockReturnValue(false);
  request.mockReset();
  const { result, unmount } = mount();
  expect(result.current.isCheckingLock).toBe(false);
  expect(result.current.verificationUnavailable).toBe(false);
  expect(request).not.toHaveBeenCalled();
  unmount();
});

it("pauses editing when a background check fails after an unlocked response", async () => {
  feature.mockReturnValue(true);
  request
    .mockReset()
    .mockResolvedValueOnce({ status: "none" })
    .mockRejectedValueOnce(new Error("503"))
    .mockResolvedValueOnce({ status: "verified" });
  const { result, unmount } = mount();
  await waitFor(() => expect(result.current.isCheckingLock).toBe(false));
  await act(async () => {
    await result.current.retryVerification();
  });
  await waitFor(() =>
    expect(result.current.verificationUnavailable).toBe(true),
  );
  expect(result.current.isCheckingLock).toBe(true);
  await act(async () => {
    await result.current.retryVerification();
  });
  await waitFor(() => expect(result.current.isLocked).toBe(true));
  expect(result.current.isCheckingLock).toBe(false);
  expect(result.current.editMode).toBe(PageEditMode.Read);
  expect(request).toHaveBeenCalledTimes(3);
  unmount();
});

it("explains a check paused offline and resumes when the network returns", async () => {
  feature.mockReturnValue(true);
  request.mockReset().mockResolvedValueOnce({ status: "none" });
  onlineManager.setOnline(false);
  const { result, unmount } = mount();
  try {
    await waitFor(() =>
      expect(result.current.verificationUnavailable).toBe(true),
    );
    expect(result.current.isCheckingLock).toBe(true);
    expect(request).not.toHaveBeenCalled();
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(result.current.isCheckingLock).toBe(false));
    expect(result.current.verificationUnavailable).toBe(false);
    expect(request).toHaveBeenCalledOnce();
  } finally {
    unmount();
    onlineManager.setOnline(true);
  }
});
