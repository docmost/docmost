import { QueryClientProvider } from "@tanstack/react-query";
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
import { listRows, updateRow } from "@/ee/base/services/base-service";
import type { FilterNode } from "@/ee/base/types/base.types";
import { scheduleRowsRefresh } from "@/ee/base/queries/rows-refresh";
import { baseRowsQueryKey, useBaseRowsQuery, useUpdateRowMutation } from "./base-row-query";

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
