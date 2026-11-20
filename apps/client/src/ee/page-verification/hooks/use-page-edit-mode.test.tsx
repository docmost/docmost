import { act, renderHook, waitFor } from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Provider } from "jotai";
import type { PropsWithChildren } from "react";
import { expect, it, vi } from "vitest";
import { usePageEditMode, usePageSyncPermission } from "./use-page-edit-mode";
import { useEntitlements } from "@/ee/entitlement/use-entitlements";
import { PageEditMode } from "@/features/user/types/user.types";

const { request, workspaceFeatures } = vi.hoisted(() => ({
  request: vi.fn(),
  workspaceFeatures: vi.fn(async () => ({ features: ["page:verification"] })),
}));
vi.mock("@/ee/entitlement/entitlement-service", () => ({
  getEntitlements: workspaceFeatures,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (v: string) => v }),
}));
vi.mock("@/ee/page-verification/services/page-verification-service", () => ({
  getVerificationInfo: request,
}));
vi.mock("@/main.tsx", () => ({}));

const lockKey = ["page-verification-info", "scratchpad"];

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

function mount<T = ReturnType<typeof usePageEditMode>>(
  hook: () => T = () => usePageEditMode("scratchpad") as T,
  client = createClient(),
) {
  const view = renderHook(hook, {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>
        <Provider>{children}</Provider>
      </QueryClientProvider>
    ),
  });
  return { client, ...view };
}

function mountWithSync(client?: QueryClient) {
  return mount(
    () => ({
      mode: usePageEditMode("scratchpad"),
      canPublish: usePageSyncPermission("scratchpad"),
    }),
    client,
  );
}

function withEntitlements(features: string[]) {
  const client = createClient();
  client.setQueryData(["entitlements"], { features });
  return client;
}

it.each(["none", "verified"] as const)(
  "holds editing through an outage and a pending retry, then honors %s",
  async (status) => {
    workspaceFeatures.mockResolvedValue({ features: ["page:verification"] });
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

it("leaves pages editable without a verification feature or status request", async () => {
  request.mockReset();
  const { result, unmount } = mount(undefined, withEntitlements([]));
  await act(async () => {});
  expect(result.current.isCheckingLock).toBe(false);
  expect(result.current.verificationUnavailable).toBe(false);
  expect(request).not.toHaveBeenCalled();
  unmount();
});

it("keeps the last lock answer when a refresh fails", async () => {
  let fail!: (error: Error) => void;
  workspaceFeatures
    .mockReset()
    .mockResolvedValue({ features: ["page:verification"] });
  request
    .mockReset()
    .mockResolvedValueOnce({ status: "none" })
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    )
    .mockResolvedValueOnce({ status: "verified" });
  const { client, result, unmount } = mount();
  await waitFor(() =>
    expect(client.getQueryState(lockKey)?.status).toBe("success"),
  );
  act(() => {
    void result.current.retryVerification();
  });
  await waitFor(() => expect(result.current.retryingVerification).toBe(true));
  await act(async () => fail(new Error("503")));
  await waitFor(() => expect(result.current.retryingVerification).toBe(false));
  expect(result.current.isCheckingLock).toBe(false);
  expect(result.current.verificationUnavailable).toBe(false);
  expect(result.current.editMode).toBe(PageEditMode.Edit);
  act(() => {
    void result.current.retryVerification();
  });
  await waitFor(() => expect(result.current.editMode).toBe(PageEditMode.Read));
  expect(request).toHaveBeenCalledTimes(3);
  unmount();
});

it("explains a first lock check paused offline and resumes when the network returns", async () => {
  request.mockReset().mockResolvedValueOnce({ status: "none" });
  const client = createClient();
  client.setQueryData(["entitlements"], { features: ["page:verification"] });
  onlineManager.setOnline(false);
  const { result, unmount } = mount(undefined, client);
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

it.each([
  ["none", PageEditMode.Edit],
  ["verified", PageEditMode.Read],
] as const)(
  "follows the page's own %s status while workspace features load",
  async (status, mode) => {
    let answer!: (response: { status: string }) => void;
    workspaceFeatures.mockReset().mockImplementationOnce(() => new Promise(() => {}));
    request.mockReset().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const { result, unmount } = mount();
    expect(result.current.isCheckingLock).toBe(true);
    await act(async () => answer({ status }));
    await waitFor(() => expect(result.current.isCheckingLock).toBe(false));
    expect(result.current.editMode).toBe(mode);
    expect(result.current.verificationUnavailable).toBe(false);
    unmount();
  },
);

it("treats a missing verification endpoint as no lock", async () => {
  workspaceFeatures.mockReset().mockImplementationOnce(() => new Promise(() => {}));
  request
    .mockReset()
    .mockRejectedValueOnce(
      Object.assign(new Error("Not Found"), {
        isAxiosError: true,
        response: { status: 404, data: { message: "Not Found" } },
      }),
    );
  const { client, result, unmount } = mountWithSync();
  await waitFor(() =>
    expect(client.getQueryState(lockKey)?.status).toBe("error"),
  );
  await waitFor(() => expect(result.current.mode.isCheckingLock).toBe(false));
  expect(result.current.mode.verificationUnavailable).toBe(false);
  expect(result.current.mode.editMode).toBe(PageEditMode.Edit);
  expect(result.current.canPublish()).toBe(true);
  unmount();
});

it("keeps a verified page locked when workspace features fail to load", async () => {
  workspaceFeatures
    .mockReset()
    .mockRejectedValueOnce(new Error("Workspace unavailable"));
  request.mockReset().mockResolvedValueOnce({ status: "verified" });
  const { client, result, unmount } = mount();
  await waitFor(() =>
    expect(client.getQueryState(["entitlements"])?.status).toBe("error"),
  );
  await waitFor(() => expect(result.current.editMode).toBe(PageEditMode.Read));
  expect(result.current.isCheckingLock).toBe(false);
  expect(result.current.verificationUnavailable).toBe(false);
  unmount();
});

it("keeps editing during a workspace features refresh", async () => {
  let deliver!: (entitlements: { features: string[] }) => void;
  workspaceFeatures.mockReset().mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        deliver = resolve;
      }),
  );
  request.mockReset();
  const { client, result, unmount } = mount(() => {
    const { isFetching } = useEntitlements();
    return { mode: usePageEditMode("scratchpad"), isFetching };
  }, withEntitlements([]));
  act(() => {
    void client.invalidateQueries({ queryKey: ["entitlements"] });
  });
  await waitFor(() => expect(result.current.isFetching).toBe(true));
  expect(result.current.mode.isCheckingLock).toBe(false);
  await act(async () => deliver({ features: [] }));
  unmount();
});

it("keeps the page editable while a lock refresh runs, then applies its answer", async () => {
  let finish!: (response: { status: string }) => void;
  workspaceFeatures
    .mockReset()
    .mockResolvedValue({ features: ["page:verification"] });
  request
    .mockReset()
    .mockResolvedValueOnce({ status: "none" })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const { client, result, unmount } = mount();
  await waitFor(() =>
    expect(client.getQueryState(lockKey)?.status).toBe("success"),
  );
  act(() => {
    void result.current.retryVerification();
  });
  await waitFor(() => expect(result.current.retryingVerification).toBe(true));
  expect(result.current.isCheckingLock).toBe(false);
  expect(result.current.editMode).toBe(PageEditMode.Edit);
  await act(async () => finish({ status: "verified" }));
  await waitFor(() => expect(result.current.editMode).toBe(PageEditMode.Read));
  expect(result.current.retryingVerification).toBe(false);
  unmount();
});

it.each([
  ["none", true],
  ["verified", false],
] as const)(
  "holds edits until the page's %s status arrives while workspace features are unavailable",
  async (status, sends) => {
    let answer!: (response: { status: string }) => void;
    workspaceFeatures
      .mockReset()
      .mockRejectedValueOnce(new Error("Workspace unavailable"));
    request.mockReset().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const { client, result, unmount } = mountWithSync();
    await waitFor(() =>
      expect(client.getQueryState(["entitlements"])?.status).toBe("error"),
    );
    expect(result.current.canPublish()).toBe(false);
    await act(async () => answer({ status }));
    await waitFor(() =>
      expect(client.getQueryState(lockKey)?.status).toBe("success"),
    );
    expect(result.current.canPublish()).toBe(sends);
    unmount();
  },
);

it("sends edits during a workspace features refresh once verification is ruled out", async () => {
  let deliver!: (entitlements: { features: string[] }) => void;
  workspaceFeatures.mockReset().mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        deliver = resolve;
      }),
  );
  request.mockReset();
  const { client, result, unmount } = mountWithSync(withEntitlements([]));
  act(() => {
    void client.invalidateQueries({ queryKey: ["entitlements"] });
  });
  expect(client.getQueryState(["entitlements"])?.fetchStatus).toBe("fetching");
  expect(result.current.canPublish()).toBe(true);
  expect(request).not.toHaveBeenCalled();
  await act(async () => deliver({ features: [] }));
  unmount();
});

it.each([
  ["none", true],
  ["verified", false],
] as const)(
  "holds edits while a lock refresh runs, then follows the last %s answer if it fails",
  async (status, sends) => {
    let fail!: (error: Error) => void;
    workspaceFeatures
      .mockReset()
      .mockResolvedValue({ features: ["page:verification"] });
    request
      .mockReset()
      .mockResolvedValueOnce({ status })
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            fail = reject;
          }),
      );
    const { client, result, unmount } = mountWithSync();
    await waitFor(() =>
      expect(client.getQueryState(lockKey)?.status).toBe("success"),
    );
    expect(result.current.canPublish()).toBe(sends);
    act(() => {
      void client.refetchQueries({ queryKey: lockKey });
    });
    expect(result.current.canPublish()).toBe(false);
    await act(async () => fail(new Error("503")));
    await waitFor(() =>
      expect(client.getQueryState(lockKey)?.status).toBe("error"),
    );
    expect(result.current.canPublish()).toBe(sends);
    unmount();
  },
);
