import { InfiniteData, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterNode, IBaseRow } from "@/ee/base/types/base.types";

const viewer = vi.hoisted(() => ({
  current: { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" },
}));

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/ee/base/services/base-service", () => ({
  listCalendarRows: vi.fn(),
  listRows: vi.fn(),
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
  deleteRows: vi.fn(),
  getRowInfo: vi.fn(),
  reorderRow: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  }),
}));
vi.mock("@/ee/base/hooks/use-viewer-date-context", () => ({
  useViewerDateContext: () => viewer.current,
}));

import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main.tsx";
import type { IBaseRowsPage } from "@/ee/base/services/base-service";
import { listCalendarRows } from "@/ee/base/services/base-service";
import { invalidateCalendarRows } from "@/ee/base/queries/base-row-query";
import { calendarWindowQueryKey, useCalendarWindowQuery } from "./calendar-window-query";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const item = (id: string) => ({ id, pageId: "p1", cells: {}, position: id }) as unknown as IBaseRow;
const page = (ids: string[], meta: object = {}) => ({
  items: ids.map(item),
  meta: { total: ids.length, truncated: false, timeZone: "America/New_York", ...meta },
});
const todayFilter: FilterNode = {
  op: "and",
  children: [{ propertyId: "due", op: "eq", value: { mode: "relative", preset: "today" } }],
};
const textFilter: FilterNode = { op: "and", children: [{ propertyId: "name", op: "contains", value: "a" }] };
const november = { propertyId: "due", from: "2026-11-01", to: "2026-12-12" };
const load = async (params: Parameters<typeof useCalendarWindowQuery>[1]) => {
  const hook = renderHook(() => useCalendarWindowQuery("p1", params), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  await act(async () => {});
  return hook;
};

beforeEach(() => {
  queryClient.clear();
  viewer.current = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
  vi.mocked(listCalendarRows).mockReset();
  vi.mocked(notifications.show).mockClear();
});
afterEach(cleanup);

describe("calendarWindowQueryKey", () => {
  const before = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
  const after = { ...before, today: "2026-11-13" };
  const key = (filter: FilterNode | undefined, v = before) => calendarWindowQueryKey("p1", "due", "2026-11-01", "2026-12-12", filter, v);

  it("keeps calendar at position 2 and the filter at position 6", () => {
    expect(key(textFilter).slice(0, 7)).toEqual(["base-rows", "p1", "calendar", "due", "2026-11-01", "2026-12-12", textFilter]);
    expect(key({ op: "and", children: [] })[6]).toBeUndefined();
  });

  it("always carries the zone, and the day only when the filter depends on it", () => {
    expect(key(undefined)[7]).toEqual({ timeZone: "America/New_York" });
    expect(key(textFilter, after)).toEqual(key(textFilter, before));
    expect(key(todayFilter)[7]).toEqual({ timeZone: "America/New_York", today: "2026-11-12" });
    expect(key(todayFilter, after)).not.toEqual(key(todayFilter, before));
  });
});

describe("useCalendarWindowQuery", () => {
  it("asks once for the window, with the viewer's zone, week start and day", async () => {
    vi.mocked(listCalendarRows).mockResolvedValue(page(["r1", "r2"]));
    const { result } = await load({ ...november, kind: "datetime", filter: textFilter });
    expect(result.current.rows.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(listCalendarRows).toHaveBeenCalledTimes(1);
    expect(vi.mocked(listCalendarRows).mock.calls[0][0]).toEqual({
      pageId: "p1",
      propertyId: "due",
      from: "2026-11-01",
      to: "2026-12-12",
      filter: textFilter,
      limit: 1000,
      timeZone: "America/New_York",
      weekStart: 0,
      today: "2026-11-12",
    });
  });

  it("does not ask before a date property is chosen", async () => {
    renderHook(() => useCalendarWindowQuery("p1", { ...november, propertyId: undefined, kind: null, filter: undefined }), { wrapper });
    await act(async () => {});
    expect(listCalendarRows).not.toHaveBeenCalled();
  });

  it("reports the total when the server cut the window short", async () => {
    vi.mocked(listCalendarRows).mockResolvedValue(page(["r1"], { total: 5754, truncated: true }));
    const { result } = await load({ ...november, kind: "date", filter: undefined });
    expect(result.current).toMatchObject({ isTruncated: true, total: 5754 });
  });

  it("does not fail on a response without meta", async () => {
    vi.mocked(listCalendarRows).mockResolvedValue({ items: [item("r1")] } as never);
    const { result } = await load({ ...november, kind: "datetime", filter: undefined });
    expect(result.current).toMatchObject({ isTruncated: false, total: 1, isError: false });
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it("is reached by the writers of the row lists and by the calendar invalidation", async () => {
    vi.mocked(listCalendarRows).mockResolvedValue(page(["r1"]));
    const { result } = await load({ ...november, kind: "date", filter: undefined });
    act(() => {
      queryClient.setQueriesData<InfiniteData<IBaseRowsPage>>({ queryKey: ["base-rows", "p1"] }, (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: [...p.items, item("r2"), item("r1")] })) } : old,
      );
    });
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(["r1", "r2"]));
    invalidateCalendarRows("p1", "none");
    const key = calendarWindowQueryKey("p1", "due", "2026-11-01", "2026-12-12", undefined, viewer.current);
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it("keeps the previous window's rows while the next one loads, without its truncation notice", async () => {
    vi.mocked(listCalendarRows).mockResolvedValueOnce(page(["r1"], { total: 9000, truncated: true }));
    const { result, rerender } = renderHook(
      ({ from, to }) => useCalendarWindowQuery("p1", { propertyId: "due", kind: "date", from, to, filter: undefined }),
      { wrapper, initialProps: { from: "2026-11-01", to: "2026-12-12" } },
    );
    await waitFor(() => expect(result.current.isTruncated).toBe(true));
    vi.mocked(listCalendarRows).mockReturnValueOnce(new Promise(() => {}) as never);
    rerender({ from: "2026-11-29", to: "2027-01-09" });
    await waitFor(() => expect(listCalendarRows).toHaveBeenCalledTimes(2));
    expect(result.current).toMatchObject({ isLoading: false, isTruncated: false });
    expect(result.current.rows.map((r) => r.id)).toEqual(["r1"]);
  });

  it("says, under the list's notification id, when the server used another zone", async () => {
    vi.mocked(listCalendarRows).mockResolvedValue(page(["r1"], { timeZone: "Europe/Berlin" }));
    await load({ ...november, kind: "datetime", filter: undefined });
    expect(notifications.show).toHaveBeenCalledWith({
      id: "base-rows-zone:p1",
      message: "Date filters use Europe/Berlin, not your time zone",
    });
  });

  it.each([
    ["the zone it was sent", "datetime", { timeZone: "America/New_York" }, undefined],
    ["another name of the zone it was sent", "datetime", { timeZone: "US/Eastern" }, undefined],
    ["another zone, for a date property with no date filter", "date", { timeZone: "Europe/Berlin" }, textFilter],
  ])("stays quiet when the response names %s", async (_name, kind, meta, filter) => {
    vi.mocked(listCalendarRows).mockResolvedValue(page(["r1"], meta));
    await load({ ...november, kind: kind as "date", filter });
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it("says so for a date property when its filter depends on the zone", async () => {
    vi.mocked(listCalendarRows).mockResolvedValue(page(["r1"], { timeZone: "Europe/Berlin" }));
    await load({ ...november, kind: "date", filter: todayFilter });
    expect(notifications.show).toHaveBeenCalled();
  });
});
