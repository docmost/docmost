import { QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
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
const viewer = vi.hoisted(() => ({
  current: { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" },
}));
vi.mock("@/ee/base/hooks/use-viewer-date-context", () => ({
  useViewerDateContext: () => viewer.current,
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  }),
}));

import { queryClient } from "@/main.tsx";
import { notifications } from "@mantine/notifications";
import { createRow, listRows, updateRow } from "@/ee/base/services/base-service";
import type { FilterNode, IBase, ViewSortConfig } from "@/ee/base/types/base.types";
import { scheduleRowsRefresh } from "@/ee/base/queries/rows-refresh";
import {
  baseRowsQueryKey,
  rowsOrderDependsOn,
  useBaseRowsQuery,
  useCreateRowMutation,
  useUpdateRowMutation,
} from "./base-row-query";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const page = (ids: string[], meta: object = {}) => ({
  items: ids.map((id) => ({ id, pageId: "p1", cells: {}, position: id })),
  meta: { nextCursor: null, ...meta },
});

beforeEach(() => {
  queryClient.clear();
  vi.mocked(scheduleRowsRefresh).mockClear();
  viewer.current = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
  vi.mocked(listRows).mockReset();
  vi.mocked(notifications.show).mockClear();
});
afterEach(cleanup);

describe("row mutations and the refresh scheduler", () => {
  it("asks for one refresh of all rows when a row update cancels a running refetch", async () => {
    const LIST = ["base-rows", "p1", undefined, undefined];
    queryClient.setQueryData(LIST, { pages: [page(["r1"])], pageParams: [undefined] });
    queryClient
      .fetchQuery({ queryKey: LIST, queryFn: () => new Promise(() => {}), staleTime: 0 })
      .catch(() => undefined);
    expect(queryClient.isFetching({ queryKey: LIST })).toBe(1);
    vi.mocked(updateRow).mockResolvedValue({ id: "r1", pageId: "p1", cells: { a: 1 }, position: "r1" } as never);

    const { result } = renderHook(() => useUpdateRowMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ rowId: "r1", pageId: "p1", cells: { a: 1 } }));

    expect(scheduleRowsRefresh).toHaveBeenCalledTimes(1);
    expect(scheduleRowsRefresh).toHaveBeenCalledWith("p1", "all");
    expect(queryClient.isFetching({ queryKey: LIST })).toBe(0);
  });
});

const todayFilter: FilterNode = {
  op: "and",
  children: [{ propertyId: "due", op: "eq", value: { mode: "relative", preset: "today" } }],
};
const textFilter: FilterNode = { op: "and", children: [{ propertyId: "name", op: "contains", value: "a" }] };
const settle = () => act(async () => {});

describe("baseRowsQueryKey", () => {
  const before = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
  const after = { ...before, today: "2026-11-13" };

  it("keeps the filter at position 2 and the sorts at position 3", () => {
    const sorts = [{ propertyId: "due", direction: "asc" as const }];
    const key = baseRowsQueryKey("p1", textFilter, sorts, before);
    expect(key.slice(0, 4)).toEqual(["base-rows", "p1", textFilter, sorts]);
  });

  it("does not change with the day unless the filter depends on it", () => {
    expect(baseRowsQueryKey("p1", textFilter, undefined, after)).toEqual(baseRowsQueryKey("p1", textFilter, undefined, before));
    expect(baseRowsQueryKey("p1", todayFilter, undefined, after)).not.toEqual(baseRowsQueryKey("p1", todayFilter, undefined, before));
  });
});

describe("useBaseRowsQuery", () => {
  it("sends the viewer's zone, week start and day with the request", async () => {
    vi.mocked(listRows).mockResolvedValue(page(["r1"]) as never);
    const { result } = renderHook(() => useBaseRowsQuery("p1", todayFilter), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(listRows).mock.calls[0][1]).toMatchObject({
      limit: 100,
      filter: todayFilter,
      timeZone: "America/New_York",
      weekStart: 0,
      today: "2026-11-12",
    });
  });

  it("asks again when the viewer's day changes under a relative filter, with the rows still on screen", async () => {
    vi.mocked(listRows).mockResolvedValueOnce(page(["r1"]) as never);
    const { result, rerender } = renderHook(() => useBaseRowsQuery("p1", todayFilter), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    let finish!: (value: unknown) => void;
    vi.mocked(listRows).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)) as never);
    viewer.current = { ...viewer.current, today: "2026-11-13" };
    rerender();

    await waitFor(() => expect(listRows).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listRows).mock.calls[1][1]).toMatchObject({ today: "2026-11-13" });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.pages[0].items[0].id).toBe("r1");

    await act(async () => finish(page(["r2"])));
    await waitFor(() => expect(result.current.data?.pages[0].items[0].id).toBe("r2"));
  });

  it("does not ask again on a day change when the filter has no relative date", async () => {
    vi.mocked(listRows).mockResolvedValue(page(["r1"]) as never);
    const { result, rerender } = renderHook(() => useBaseRowsQuery("p1", textFilter), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    viewer.current = { ...viewer.current, today: "2026-11-13" };
    rerender();
    await settle();
    expect(listRows).toHaveBeenCalledTimes(1);
  });

  it("does not show the rows of another filter while the new ones load", async () => {
    vi.mocked(listRows).mockResolvedValueOnce(page(["r1"]) as never);
    const { result, rerender } = renderHook(({ filter }) => useBaseRowsQuery("p1", filter), {
      wrapper,
      initialProps: { filter: todayFilter },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    vi.mocked(listRows).mockReturnValueOnce(new Promise(() => {}) as never);
    rerender({ filter: textFilter });
    await waitFor(() => expect(listRows).toHaveBeenCalledTimes(2));
    expect(result.current.data).toBeUndefined();
  });

  it("says so when the server used another zone for a date filter", async () => {
    vi.mocked(listRows).mockResolvedValue(page(["r1"], { timeZone: "Europe/Berlin" }) as never);
    renderHook(() => useBaseRowsQuery("p1", todayFilter), { wrapper });
    await waitFor(() => expect(notifications.show).toHaveBeenCalled());
    expect(notifications.show).toHaveBeenCalledWith({
      id: "base-rows-zone:p1",
      message: "Date filters use Europe/Berlin, not your time zone",
    });
  });

  it.each([
    ["the zone it was sent", { timeZone: "America/New_York" }, todayFilter],
    ["another name of the zone it was sent", { timeZone: "US/Eastern" }, todayFilter],
    ["no zone, as an older server does", {}, todayFilter],
    ["another zone, for a filter without dates", { timeZone: "Europe/Berlin" }, textFilter],
  ])("stays quiet when the response names %s", async (_name, meta, filter) => {
    vi.mocked(listRows).mockResolvedValue(page(["r1"], meta) as never);
    const { result } = renderHook(() => useBaseRowsQuery("p1", filter), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await settle();
    expect(notifications.show).not.toHaveBeenCalled();
  });
});

describe("zone notice when the viewer's zone changes", () => {
  it("stays quiet while the new request is pending and after it answers with the new zone", async () => {
    vi.mocked(listRows).mockResolvedValueOnce(page(["r1"], { timeZone: "America/New_York" }) as never);
    const { result, rerender } = renderHook(() => useBaseRowsQuery("p1", todayFilter), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    let finish!: (value: unknown) => void;
    vi.mocked(listRows).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)) as never);
    viewer.current = { ...viewer.current, timeZone: "Europe/Berlin" };
    rerender();
    await waitFor(() => expect(listRows).toHaveBeenCalledTimes(2));
    expect(result.current.isPlaceholderData).toBe(true);
    await settle();
    expect(notifications.show).not.toHaveBeenCalled();

    await act(async () => finish(page(["r2"], { timeZone: "Europe/Berlin" })));
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    await settle();
    expect(notifications.show).not.toHaveBeenCalled();
  });
});

const prop = (id: string, type: string) => ({ id, type, name: id, pageId: "p1", position: id, typeOptions: {}, isPrimary: false });
const base = {
  id: "p1",
  properties: [
    prop("prptext000001", "text"),
    prop("prpdue0000001", "date"),
    prop("prpformula001", "formula"),
    prop("prpedited0001", "lastEditedAt"),
  ],
  views: [],
} as unknown as IBase;
const sortOn = (propertyId: string): ViewSortConfig[] => [{ propertyId, direction: "asc" }];
const nestedFilter: FilterNode = {
  op: "and",
  children: [{ op: "or", children: [{ propertyId: "prptext000001", op: "contains", value: "a" }] }],
};
const listObservers: (() => void)[] = [];
afterEach(() => listObservers.splice(0).forEach((unsubscribe) => unsubscribe()));
const cacheList = (filter: FilterNode | string | undefined, sorts: ViewSortConfig[] | undefined, observed = true) => {
  const queryKey = ["base-rows", "p1", filter, sorts, undefined];
  queryClient.setQueryData(queryKey, { pages: [page(["r1"])], pageParams: [undefined] });
  if (observed) {
    const observer = new QueryObserver(queryClient, { queryKey, queryFn: () => new Promise(() => {}), staleTime: Infinity });
    listObservers.push(observer.subscribe(() => {}));
  }
  return queryKey;
};

describe("rowsOrderDependsOn", () => {
  it.each([
    ["no filter, no sorts", undefined, undefined, ["prptext000001"], false],
    ["sorts on the changed property", undefined, sortOn("prpdue0000001"), ["prpdue0000001"], true],
    ["sorts on another property", undefined, sortOn("prpdue0000001"), ["prptext000001"], false],
    ["a nested filter on the changed property", nestedFilter, undefined, ["prptext000001"], true],
    ["sorts on a formula", undefined, sortOn("prpformula001"), ["prptext000001"], true],
    ["sorts on Last edited at", undefined, sortOn("prpedited0001"), ["prptext000001"], true],
    ["sorts, for a created row", undefined, sortOn("prpdue0000001"), "any", true],
    ["no filter, no sorts, for a created row", undefined, undefined, "any", false],
    ["sorts on a property that is not in the base", undefined, sortOn("prpgone000001"), ["prptext000001"], true],
  ] as const)("%s", (_name, filter, sorts, changed, expected) => {
    cacheList(filter as FilterNode | undefined, sorts as ViewSortConfig[] | undefined);
    expect(rowsOrderDependsOn("p1", changed, base)).toBe(expected);
  });

  it("ignores the calendar's lists", () => {
    cacheList("calendar", undefined);
    queryClient.setQueryData(["base-rows", "p1", "calendar", nestedFilter], { pages: [page(["r1"])], pageParams: [undefined] });
    expect(rowsOrderDependsOn("p1", "any", base)).toBe(false);
  });

  it("does not count a list nobody is looking at, and marks it stale", () => {
    const key = cacheList(undefined, sortOn("prpdue0000001"), false);
    expect(rowsOrderDependsOn("p1", ["prpdue0000001"], base)).toBe(false);
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it("leaves a cached list alone when its order does not depend on the change", () => {
    const key = cacheList(undefined, sortOn("prpdue0000001"), false);
    expect(rowsOrderDependsOn("p1", ["prptext000001"], base)).toBe(false);
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });

  it("treats every property as affected when the base is not cached", () => {
    cacheList(undefined, sortOn("prpdue0000001"));
    expect(rowsOrderDependsOn("p1", ["prptext000001"], undefined)).toBe(true);
  });
});

describe("refreshing rows after the user's own edit", () => {
  const row = (cells: object) => ({ id: "r1", pageId: "p1", cells, position: "a" });
  const seed = (sorts: ViewSortConfig[] | undefined) => {
    queryClient.setQueryData(["bases", "p1"], base);
    cacheList(undefined, sorts);
  };

  it("asks once for all rows when the update touched a sorted property", async () => {
    seed(sortOn("prpdue0000001"));
    vi.mocked(updateRow).mockResolvedValue(row({ prpdue0000001: { start: "2026-11-12" } }) as never);
    const { result } = renderHook(() => useUpdateRowMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ rowId: "r1", pageId: "p1", cells: { prpdue0000001: { start: "2026-11-12" } } }));
    expect(scheduleRowsRefresh).toHaveBeenCalledTimes(1);
    expect(scheduleRowsRefresh).toHaveBeenCalledWith("p1", "all");
  });

  it("asks for nothing when the update touched an unrelated property", async () => {
    seed(sortOn("prpdue0000001"));
    vi.mocked(updateRow).mockResolvedValue(row({ prptext000001: "x" }) as never);
    const { result } = renderHook(() => useUpdateRowMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ rowId: "r1", pageId: "p1", cells: { prptext000001: "x" } }));
    expect(scheduleRowsRefresh).not.toHaveBeenCalled();
  });

  it("asks once for two chained updates of one row", async () => {
    seed(sortOn("prpdue0000001"));
    vi.mocked(updateRow).mockResolvedValue(row({}) as never);
    const { result } = renderHook(() => useUpdateRowMutation(), { wrapper });
    await act(async () => {
      await Promise.all([
        result.current.mutateAsync({ rowId: "r1", pageId: "p1", cells: { prpdue0000001: { start: "2026-11-12" } } }),
        result.current.mutateAsync({ rowId: "r1", pageId: "p1", cells: { prpdue0000001: { start: "2026-11-13" } } }),
      ]);
    });
    expect(scheduleRowsRefresh).toHaveBeenCalledTimes(1);
  });

  it("asks for nothing when the update fails", async () => {
    seed(sortOn("prpdue0000001"));
    vi.mocked(updateRow).mockRejectedValue(new Error("no"));
    const { result } = renderHook(() => useUpdateRowMutation(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ rowId: "r1", pageId: "p1", cells: { prpdue0000001: { start: "2026-11-12" } } }).catch(() => undefined),
    );
    expect(scheduleRowsRefresh).not.toHaveBeenCalled();
  });

  it("asks once after a create under a sorted list", async () => {
    seed(sortOn("prpdue0000001"));
    vi.mocked(createRow).mockResolvedValue(row({}) as never);
    const { result } = renderHook(() => useCreateRowMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ pageId: "p1" } as never));
    expect(scheduleRowsRefresh).toHaveBeenCalledTimes(1);
    expect(scheduleRowsRefresh).toHaveBeenCalledWith("p1", "all");
  });

  it("asks for nothing after a create under an unsorted, unfiltered list", async () => {
    seed(undefined);
    vi.mocked(createRow).mockResolvedValue(row({}) as never);
    const { result } = renderHook(() => useCreateRowMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ pageId: "p1" } as never));
    expect(scheduleRowsRefresh).not.toHaveBeenCalled();
  });

  it("asks for no refresh when the update regroups a board, which reloads the rows once", async () => {
    const boardBase = {
      ...base,
      views: [{ id: "v2", type: "kanban", config: { groupByPropertyId: "prpdue0000001" } }],
    } as unknown as IBase;
    queryClient.setQueryData(["bases", "p1"], boardBase);
    const key = cacheList(undefined, sortOn("prpdue0000001"));
    vi.mocked(updateRow).mockResolvedValue(row({ prpdue0000001: { start: "2026-11-12" } }) as never);
    const { result } = renderHook(() => useUpdateRowMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ rowId: "r1", pageId: "p1", cells: { prpdue0000001: { start: "2026-11-12" } } }));
    expect(scheduleRowsRefresh).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });
});

describe("a condition the released client saved", () => {
  it("sends eq with a text value under a formula unchanged", async () => {
    vi.mocked(listRows).mockResolvedValue(page(["r1"]) as never);
    const filter: FilterNode = { op: "and", children: [{ propertyId: "prpformula001", op: "eq", value: "abc" }] };
    renderHook(() => useBaseRowsQuery("p1", filter), { wrapper });
    await waitFor(() => expect(listRows).toHaveBeenCalledTimes(1));
    expect(vi.mocked(listRows).mock.calls[0][1]).toMatchObject({
      filter: { op: "and", children: [{ propertyId: "prpformula001", op: "eq", value: "abc" }] },
    });
  });
});
