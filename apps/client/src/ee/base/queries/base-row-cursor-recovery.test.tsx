import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { getDefaultStore, type WritableAtom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnMount: false } },
  }),
}));
vi.mock("@/ee/base/services/base-service", () => ({
  listRows: vi.fn(),
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
  deleteRows: vi.fn(),
  getRowInfo: vi.fn(),
  reorderRow: vi.fn(),
}));
vi.mock("@/ee/base/queries/rows-refresh", () => ({
  scheduleRowsRefresh: vi.fn(),
  cancelRowsRefresh: vi.fn(),
}));
vi.mock("@/ee/base/hooks/use-viewer-date-context", () => ({
  useViewerDateContext: () => ({
    timeZone: "UTC",
    weekStart: 0,
    today: "2026-11-17",
  }),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (text: string) => text }),
}));

import { queryClient } from "@/main.tsx";
import { listRows } from "@/ee/base/services/base-service";
import { baseRowsQueryKey, useBaseRowsQuery } from "./base-row-query";
import { editingCellAtomFamily } from "@/ee/base/atoms/base-atoms";
import { BASE_ROW_MUTATION_KEY } from "./row-update-chain";
import type { EditingCell } from "@/ee/base/types/base.types";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const sorts = [{ propertyId: "description", direction: "asc" as const }];
const editingAtom = editingCellAtomFamily("p1") as unknown as WritableAtom<
  EditingCell,
  [EditingCell],
  void
>;
const page = (id: string, nextCursor: string | null = null) => ({
  items: [{ id, pageId: "p1", cells: {}, position: id }],
  meta: { nextCursor },
});
const apiError = (code: string, status = 400) => ({
  isAxiosError: true,
  response: { status, data: { code, message: "Rows changed" } },
});

beforeEach(() => {
  queryClient.clear();
  vi.mocked(listRows).mockReset();
  getDefaultStore().set(editingAtom, null);
});
afterEach(cleanup);

describe("row cursor recovery", () => {
  it("restarts from page one when an oversized sort cursor's anchor changed or was deleted", async () => {
    vi.mocked(listRows)
      .mockResolvedValueOnce(page("old-first", "old-reference") as never)
      .mockRejectedValueOnce(apiError("BASE_CURSOR_STALE"))
      .mockResolvedValueOnce(page("new-first", "new-reference") as never)
      .mockResolvedValueOnce(page("new-second") as never);
    const { result } = renderHook(
      () => useBaseRowsQuery("p1", undefined, sorts),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.data?.pages[0].items[0].id).toBe("new-first"),
    );
    expect(result.current.data?.pageParams).toEqual([undefined]);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(
      result.current.data?.pages.flatMap((p) => p.items.map((row) => row.id)),
    ).toEqual(["new-first", "new-second"]);
    expect(
      vi.mocked(listRows).mock.calls.map((call) => call[1]?.cursor),
    ).toEqual([undefined, "old-reference", undefined, "new-reference"]);
    expect(result.current.isError).toBe(false);
  });

  it("resets stale later pages during a refetch and leaves other views cached", async () => {
    const otherKey = baseRowsQueryKey("p2", undefined, sorts, {
      timeZone: "UTC",
      weekStart: 0,
      today: "2026-11-17",
    });
    const otherData = { pages: [page("other")], pageParams: [undefined] };
    queryClient.setQueryData(otherKey, otherData);
    vi.mocked(listRows)
      .mockResolvedValueOnce(page("old-first", "old-reference") as never)
      .mockResolvedValueOnce(page("old-second") as never)
      .mockResolvedValueOnce(
        page("changed-first", "changed-reference") as never,
      )
      .mockRejectedValueOnce(apiError("BASE_CURSOR_STALE"))
      .mockResolvedValueOnce(page("fresh-first") as never);
    const { result } = renderHook(
      () => useBaseRowsQuery("p1", undefined, sorts),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() =>
      expect(result.current.data?.pages[0].items[0].id).toBe("fresh-first"),
    );
    expect(result.current.data?.pages).toHaveLength(1);
    expect(queryClient.getQueryData(otherKey)).toEqual(otherData);
  });

  it.each([
    apiError("FORBIDDEN", 403),
    apiError("INVALID_CURSOR"),
    new Error("offline"),
  ])(
    "retains rows and exposes ordinary request errors without resetting: %j",
    async (error) => {
      vi.mocked(listRows)
        .mockResolvedValueOnce(page("first", "reference") as never)
        .mockRejectedValueOnce(error);
      const { result } = renderHook(
        () => useBaseRowsQuery("p1", undefined, sorts),
        { wrapper },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      await act(async () => {
        await result.current.fetchNextPage();
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.data?.pages[0].items[0].id).toBe("first");
      expect(listRows).toHaveBeenCalledTimes(2);
    },
  );

  it("stops recovery if the first-page request also fails", async () => {
    vi.mocked(listRows)
      .mockResolvedValueOnce(page("first", "reference") as never)
      .mockRejectedValue(apiError("BASE_CURSOR_STALE"));
    const { result } = renderHook(
      () => useBaseRowsQuery("p1", undefined, sorts),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(listRows).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    await act(async () => {});
    expect(listRows).toHaveBeenCalledTimes(3);
  });

  it("performs one recovery request when two observers share the same list", async () => {
    vi.mocked(listRows)
      .mockResolvedValueOnce(page("old", "reference") as never)
      .mockRejectedValueOnce(apiError("BASE_CURSOR_STALE"))
      .mockResolvedValueOnce(page("fresh") as never);
    const { result } = renderHook(
      () => ({
        first: useBaseRowsQuery("p1", undefined, sorts),
        second: useBaseRowsQuery("p1", undefined, sorts),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.first.isSuccess).toBe(true));
    await act(async () => {
      await result.current.first.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.first.data?.pages[0].items[0].id).toBe("fresh"),
    );
    expect(result.current.second.data?.pages[0].items[0].id).toBe("fresh");
    expect(listRows).toHaveBeenCalledTimes(3);
  });

  it("waits for an active cell editor to finish before resetting its rows", async () => {
    vi.mocked(listRows)
      .mockResolvedValueOnce(page("old", "reference") as never)
      .mockRejectedValueOnce(apiError("BASE_CURSOR_STALE"))
      .mockResolvedValueOnce(page("fresh") as never);
    const store = getDefaultStore();
    const editing = editingAtom;
    store.set(editing, { rowId: "old", propertyId: "description" });
    const { result } = renderHook(
      () => useBaseRowsQuery("p1", undefined, sorts),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(listRows).toHaveBeenCalledTimes(2);
    expect(result.current.data?.pages[0].items[0].id).toBe("old");
    await act(async () => {
      store.set(editing, null);
    });
    await waitFor(() =>
      expect(result.current.data?.pages[0].items[0].id).toBe("fresh"),
    );
  });

  it("waits for an in-flight row mutation before recovering its list", async () => {
    vi.mocked(listRows)
      .mockResolvedValueOnce(page("old", "reference") as never)
      .mockRejectedValueOnce(apiError("BASE_CURSOR_STALE"))
      .mockResolvedValueOnce(page("fresh") as never);
    let finish!: () => void;
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: BASE_ROW_MUTATION_KEY,
      mutationFn: (_variables: { pageId: string }) =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });
    const pending = mutation.execute({ pageId: "p1" });
    const { result } = renderHook(
      () => useBaseRowsQuery("p1", undefined, sorts),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(listRows).toHaveBeenCalledTimes(2);
    await act(async () => {
      finish();
      await pending;
    });
    await waitFor(() =>
      expect(result.current.data?.pages[0].items[0].id).toBe("fresh"),
    );
  });
});
