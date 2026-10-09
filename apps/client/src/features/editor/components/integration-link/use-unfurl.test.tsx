import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { ReactNode } from "react";
import { useUnfurl } from "./use-unfurl";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { unfurlUrl } from "@/features/integration/services/integration-service";
import {
  UnfurlNeedsConnection,
  UnfurlResult,
} from "@/features/integration/types/integration.types";

vi.mock("@/features/integration/services/integration-service", () => ({
  unfurlUrl: vi.fn(),
}));

const mockedUnfurlUrl = vi.mocked(unfurlUrl);

const ISSUE_URL = "https://github.com/acme/repo/issues/42";

const loadedResult: UnfurlResult = {
  title: "Fix race condition in file watcher",
  url: ISSUE_URL,
  provider: "github",
  status: "open",
};

const needsConnectionResult: UnfurlNeedsConnection = {
  needsConnection: true,
  integrationId: "int-1",
  integrationType: "github",
  integrationName: "GitHub",
  title: "GitHub link",
  description: "github.com/acme/repo/issues/42",
};

function createWrapper(loggedIn: boolean) {
  const store = createStore();
  if (loggedIn) {
    store.set(currentUserAtom, { user: { id: "user-1" } } as any);
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}

describe("useUnfurl", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it("never fetches for anonymous viewers and reports anonymous", () => {
    const { result } = renderHook(() => useUnfurl(ISSUE_URL), {
      wrapper: createWrapper(false),
    });

    expect(result.current.state).toBe("anonymous");
    expect(mockedUnfurlUrl).not.toHaveBeenCalled();
  });

  it("starts loading then exposes the unfurl result", async () => {
    mockedUnfurlUrl.mockResolvedValue(loadedResult);

    const { result } = renderHook(() => useUnfurl(ISSUE_URL), {
      wrapper: createWrapper(true),
    });

    expect(result.current.state).toBe("loading");
    await waitFor(() => expect(result.current.state).toBe("loaded"));
    expect(
      result.current.state === "loaded" && result.current.data,
    ).toEqual(loadedResult);
    expect(mockedUnfurlUrl).toHaveBeenCalledWith({ url: ISSUE_URL });
  });

  it("maps a needsConnection response without treating it as an error", async () => {
    mockedUnfurlUrl.mockResolvedValue(needsConnectionResult);

    const { result } = renderHook(() => useUnfurl(ISSUE_URL), {
      wrapper: createWrapper(true),
    });

    await waitFor(() =>
      expect(result.current.state).toBe("needsConnection"),
    );
    expect(
      result.current.state === "needsConnection" &&
        result.current.needsConnection,
    ).toEqual(needsConnectionResult);
  });

  it("maps a null result (no matching provider) to error", async () => {
    mockedUnfurlUrl.mockResolvedValue(null);

    const { result } = renderHook(() => useUnfurl(ISSUE_URL), {
      wrapper: createWrapper(true),
    });

    await waitFor(() => expect(result.current.state).toBe("error"));
  });

  it("maps a rejected request to error", async () => {
    mockedUnfurlUrl.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useUnfurl(ISSUE_URL), {
      wrapper: createWrapper(true),
    });

    await waitFor(() => expect(result.current.state).toBe("error"));
  });
});
