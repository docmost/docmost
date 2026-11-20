import { QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { queryClient } from "@/main";
import { deletePage, getPageById, restorePage } from "../services/page-service";
import type { IPage } from "../types/page.types";
import {
  usePageQuery,
  useRemovePageMutation,
  useRestorePageMutation,
} from "./page-query";

vi.mock("@/main", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  }),
}));
vi.mock("../services/page-service", () => ({
  deletePage: vi.fn(),
  getPageById: vi.fn(),
  restorePage: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));

afterEach(() => {
  cleanup();
  queryClient.clear();
});

it("refreshes favorite lists and IDs when a page tree is trashed and restored", async () => {
  const parent = {
    id: "parent",
    slugId: "parentSlug",
    spaceId: "space-1",
  } as IPage;
  const child = {
    id: "child",
    slugId: "childSlug",
    spaceId: parent.spaceId,
    isBase: true,
  };
  const keys = [
    ["favorites", undefined, undefined],
    ["favorites", "page", undefined],
    ["favorites", "page", parent.spaceId],
    ["favorite-ids", "page", undefined],
    ["favorite-ids", "page", parent.spaceId],
  ];
  let items = ["child"];
  queryClient.setQueryData(["pages", child.slugId], {
    ...child,
    deletedAt: null,
  });
  vi.mocked(getPageById).mockImplementation(
    async () =>
      ({
        ...child,
        deletedAt: items.length ? null : new Date(),
      }) as IPage,
  );
  vi.mocked(deletePage).mockImplementation(async () => {
    items = [];
  });
  vi.mocked(restorePage).mockImplementation(async () => {
    items = ["child"];
    return parent;
  });
  const subscriptions = keys.map((queryKey) => {
    queryClient.setQueryData(queryKey, items);
    return new QueryObserver(queryClient, {
      queryKey,
      queryFn: () => items,
    }).subscribe(() => {});
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () => ({
      trash: useRemovePageMutation(parent.spaceId),
      restore: useRestorePageMutation(),
    }),
    { wrapper },
  );

  try {
    await act(() => result.current.trash.mutateAsync(parent.id));
    await waitFor(() =>
      keys.forEach((key) => expect(queryClient.getQueryData(key)).toEqual([])),
    );
    const reopened = renderHook(() => usePageQuery({ pageId: child.slugId }), {
      wrapper,
    });
    await waitFor(() =>
      expect(reopened.result.current.data?.deletedAt).toBeTruthy(),
    );
    await act(() => result.current.restore.mutateAsync(parent.id));
    await waitFor(() =>
      keys.forEach((key) =>
        expect(queryClient.getQueryData(key)).toEqual(["child"]),
      ),
    );
    await waitFor(() =>
      expect(reopened.result.current.data?.deletedAt).toBeNull(),
    );
  } finally {
    subscriptions.forEach((unsubscribe) => unsubscribe());
  }
});
