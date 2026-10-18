import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createStore, PrimitiveAtom, Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { queryClient } from "@/main.tsx";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";
import { useQuerySubscription } from "./use-query-subscription";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

const isInvalidated = (...key: string[]) =>
  queryClient.getQueryState(key)?.isInvalidated;

function receiveEvents() {
  let handler: (event: unknown) => void = () => undefined;
  const socket = {
    on: vi.fn((_name: string, listener: (event: unknown) => void) => {
      handler = listener;
    }),
  } as unknown as Socket;

  const store = createStore();
  store.set(socketAtom as PrimitiveAtom<Socket | null>, socket);
  renderHook(() => useQuerySubscription(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <JotaiProvider store={store}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </JotaiProvider>
    ),
  });

  return (event: unknown) => handler(event);
}

beforeEach(() => {
  queryClient.clear();
  const page = { id: "page-1", slugId: "slug-1" };
  queryClient.setQueryData(["pages", "page-1"], page);
  queryClient.setQueryData(["pages", "slug-1"], page);
  queryClient.setQueryData(["pages", "page-2"], { id: "page-2", slugId: "s2" });
  queryClient.setQueryData(["page-verification-info", "page-1"], {});
  queryClient.setQueryData(["page-history-list", "page-1"], {});
  queryClient.setQueryData(["page-history-list", "page-2"], {});
});

describe("approval websocket events", () => {
  it("verificationUpdated refreshes the page, its verification info and its history", () => {
    const receive = receiveEvents();

    receive({ operation: "verificationUpdated", pageId: "page-1" });

    expect(isInvalidated("pages", "page-1")).toBe(true);
    expect(isInvalidated("pages", "slug-1")).toBe(true);
    expect(isInvalidated("page-verification-info", "page-1")).toBe(true);
    expect(isInvalidated("page-history-list", "page-1")).toBe(true);
    expect(isInvalidated("pages", "page-2")).toBe(false);
    expect(isInvalidated("page-history-list", "page-2")).toBe(false);
  });

  it("pageApprovalPublished refreshes what readers see of the page", () => {
    const receive = receiveEvents();

    receive({
      operation: "pageApprovalPublished",
      pageId: "page-1",
      spaceId: "space-1",
      slugId: "slug-1",
    });

    expect(isInvalidated("pages", "page-1")).toBe(true);
    expect(isInvalidated("pages", "slug-1")).toBe(true);
    expect(isInvalidated("page-verification-info", "page-1")).toBe(true);
    expect(isInvalidated("page-history-list", "page-1")).toBe(true);
    expect(isInvalidated("pages", "page-2")).toBe(false);
  });
});
