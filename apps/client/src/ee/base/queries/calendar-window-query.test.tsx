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
import type { IBaseRowsPage, ICalendarRowsPage } from "@/ee/base/services/base-service";
import { createRow, listCalendarRows, updateRow } from "@/ee/base/services/base-service";
import {
  invalidateCalendarRows,
  useCreateRowMutation,
  useKanbanCreateCardMutation,
  useKanbanMoveCardMutation,
  useUpdateRowMutation,
} from "@/ee/base/queries/base-row-query";
import { cancelRowsRefresh } from "@/ee/base/queries/rows-refresh";
import { forgetRowsZoneNotices } from "@/ee/base/queries/rows-zone-notice";
import { CALENDAR_WINDOW_LIMIT, calendarWindowQueryKey, useCalendarWindowQuery } from "./calendar-window-query";

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
  forgetRowsZoneNotices();
});
afterEach(cleanup);

describe("calendar windows after a row is saved", () => {
  const window = { ...november, kind: "date", filter: undefined } as const;
  const event = (day: string): IBaseRow => ({ ...item("r1"), cells: { due: { start: day } } });
  const events = (...items: IBaseRow[]): ICalendarRowsPage => ({
    items,
    meta: { total: items.length, truncated: false, timeZone: "America/New_York" },
  });

  beforeEach(() => {
    queryClient.setQueryData(["bases", "p1"], {
      id: "p1",
      properties: [
        { id: "due", type: "date" },
        { id: "name", type: "text" },
        { id: "created", type: "createdAt" },
        { id: "status", type: "select" },
      ],
      views: [{ type: "calendar", config: { calendar: { datePropertyId: "due" } } }],
    });
    vi.mocked(createRow).mockReset();
    vi.mocked(updateRow).mockReset();
  });
  afterEach(() => cancelRowsRefresh("p1"));

  it("moves a row between open months and updates both totals", async () => {
    let day = "2027-01-05";
    queryClient.setQueryData(["base-row", "p1", "r1"], event(day));
    vi.mocked(listCalendarRows).mockImplementation(async ({ from, to }) =>
      from <= day && day <= to ? events(event(day)) : events(),
    );
    const destination = await load(window);
    const source = await load({ ...window, from: "2027-01-01", to: "2027-01-31" });
    expect(source.result.current.rows).toEqual([event(day)]);
    expect(destination.result.current.rows).toEqual([]);
    const moved = event("2026-11-19");
    vi.mocked(updateRow).mockImplementation(async () => {
      day = "2026-11-19";
      return moved;
    });
    const mutation = renderHook(() => useUpdateRowMutation(), { wrapper });
    await act(() => mutation.result.current.mutateAsync({ pageId: "p1", rowId: "r1", cells: moved.cells }));

    await waitFor(() => {
      expect(destination.result.current).toMatchObject({ rows: [moved], total: 1 });
      expect(source.result.current).toMatchObject({ rows: [], total: 0 });
    });
  });

  it("shows a new event only in matching windows and updates their totals", async () => {
    const created = event("2026-11-19");
    let saved = false;
    vi.mocked(listCalendarRows).mockImplementation(async ({ filter }) =>
      saved && !filter ? events(created) : events(),
    );
    const unfiltered = await load(window);
    const filtered = await load({ ...window, filter: textFilter });
    vi.mocked(createRow).mockImplementation(async () => {
      saved = true;
      return created;
    });
    const mutation = renderHook(() => useCreateRowMutation(), { wrapper });
    await act(() => mutation.result.current.mutateAsync({ pageId: "p1", cells: created.cells }));

    const filteredKey = calendarWindowQueryKey("p1", window.propertyId, window.from, window.to, textFilter, viewer.current);
    expect(queryClient.getQueryData<InfiniteData<ICalendarRowsPage>>(filteredKey)?.pages[0].items).toEqual([]);
    await waitFor(() => expect(unfiltered.result.current.total).toBe(1));
    expect(unfiltered.result.current.rows).toEqual([created]);
    expect(filtered.result.current).toMatchObject({ rows: [], total: 0 });
  });

  it("fills the free slot when an event moves out of a full window", async () => {
    const rows = Array.from({ length: CALENDAR_WINDOW_LIMIT + 1 }, (_, i) => ({
      ...event("2026-11-19"), id: String(i),
    }));
    const full = events(...rows.slice(0, CALENDAR_WINDOW_LIMIT));
    vi.mocked(listCalendarRows)
      .mockResolvedValueOnce({ ...full, meta: { ...full.meta, total: rows.length, truncated: true } })
      .mockResolvedValue(events(...rows.slice(1)));
    const calendar = await load(window);
    expect(calendar.result.current.isTruncated).toBe(true);
    const moved = { ...rows[0], cells: { due: { start: "2027-01-05" } } };
    vi.mocked(updateRow).mockResolvedValue(moved);
    const mutation = renderHook(() => useUpdateRowMutation(), { wrapper });
    await act(() => mutation.result.current.mutateAsync({ pageId: "p1", rowId: moved.id, cells: moved.cells }));

    await waitFor(() => expect(calendar.result.current.isTruncated).toBe(false));
    expect(calendar.result.current.total).toBe(CALENDAR_WINDOW_LIMIT);
    expect(calendar.result.current.rows.map((row) => row.id)).toEqual(rows.slice(1).map((row) => row.id));
  });

  it("shows a card created on a board in an open calendar using its creation date", async () => {
    const card = { ...item("r1"), createdAt: "2026-11-19T10:00:00Z" };
    vi.mocked(listCalendarRows).mockResolvedValueOnce(events()).mockResolvedValue(events(card));
    const calendar = await load({ ...window, propertyId: "created", kind: "datetime" });
    vi.mocked(createRow).mockResolvedValue(card);
    const mutation = renderHook(() => useKanbanCreateCardMutation(), { wrapper });
    await act(() => mutation.result.current.mutateAsync({
      pageId: "p1", groupByPropertyId: "status", columnKey: "done", destColumnFilter: undefined,
    }));

    await waitFor(() => expect(calendar.result.current).toMatchObject({ rows: [card], total: 1 }));
  });

  it("shows an event that matches the calendar filter after a board move", async () => {
    const card = event("2026-11-19");
    card.cells.status = "done";
    const filter: FilterNode = { propertyId: "status", op: "eq", value: "done" };
    vi.mocked(listCalendarRows).mockResolvedValueOnce(events()).mockResolvedValue(events(card));
    const calendar = await load({ ...window, filter });
    vi.mocked(updateRow).mockResolvedValue(card);
    const mutation = renderHook(() => useKanbanMoveCardMutation(), { wrapper });
    await act(() => mutation.result.current.mutateAsync({
      pageId: "p1", rowId: "r1", sourceColumnFilter: undefined, destColumnFilter: filter,
      columnChanged: true, groupByPropertyId: "status", destChoiceValue: "done", position: "a0",
    }));

    await waitFor(() => expect(calendar.result.current).toMatchObject({ rows: [card], total: 1 }));
  });

  it("discards a window's first read if it starts before a move finishes", async () => {
    const moved = event("2026-11-19");
    let finishMove: (row: IBaseRow) => void;
    vi.mocked(updateRow).mockImplementation(() => new Promise((resolve) => { finishMove = resolve; }));
    let finishRead: (page: ICalendarRowsPage) => void;
    vi.mocked(listCalendarRows)
      .mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }))
      .mockResolvedValue(events(moved));

    const mutation = renderHook(() => useUpdateRowMutation(), { wrapper });
    let saving: Promise<IBaseRow>;
    act(() => {
      saving = mutation.result.current.mutateAsync({ pageId: "p1", rowId: "r1", cells: moved.cells });
    });
    await waitFor(() => expect(updateRow).toHaveBeenCalledOnce());
    const calendar = renderHook(() => useCalendarWindowQuery("p1", window), { wrapper });
    await waitFor(() => expect(listCalendarRows).toHaveBeenCalledOnce());
    const signal = vi.mocked(listCalendarRows).mock.calls[0][1];
    await act(async () => { finishMove(moved); await saving; });

    await act(async () => finishRead(events(event("2026-11-18"))));
    expect(signal.aborted).toBe(true);
    await waitFor(() => expect(calendar.result.current.rows).toEqual([moved]));
  });
});

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
    vi.mocked(listCalendarRows).mockResolvedValue(page(["r2"]));
    act(() => invalidateCalendarRows("p1"));
    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(["r2"]));
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

  it("reports the number of rows shown, not the previous window's total, while the next one loads", async () => {
    vi.mocked(listCalendarRows).mockResolvedValueOnce(page(["r1", "r2"], { total: 9000, truncated: true }));
    const { result, rerender } = renderHook(
      ({ from, to }) => useCalendarWindowQuery("p1", { propertyId: "due", kind: "date", from, to, filter: undefined }),
      { wrapper, initialProps: { from: "2026-11-01", to: "2026-12-12" } },
    );
    await waitFor(() => expect(result.current.total).toBe(9000));
    vi.mocked(listCalendarRows).mockReturnValueOnce(new Promise(() => {}) as never);
    rerender({ from: "2026-11-29", to: "2027-01-09" });
    await waitFor(() => expect(listCalendarRows).toHaveBeenCalledTimes(2));
    expect(result.current).toMatchObject({ isTruncated: false, total: 2 });
  });

  it("says, under the list's notification id and in its own words, when the server used another zone", async () => {
    vi.mocked(listCalendarRows).mockResolvedValue(page(["r1"], { timeZone: "Europe/Berlin" }));
    await load({ ...november, kind: "datetime", filter: undefined });
    expect(notifications.show).toHaveBeenCalledWith({
      id: "base-rows-zone:p1",
      message: "This calendar uses Europe/Berlin, not your time zone",
    });
  });

  it("says it once while the viewer pages through windows the server places in the same other zone", async () => {
    vi.mocked(listCalendarRows).mockResolvedValue(page(["r1"], { timeZone: "Europe/Berlin" }));
    const { result, rerender } = renderHook(
      ({ from, to }) => useCalendarWindowQuery("p1", { propertyId: "due", kind: "datetime", from, to, filter: undefined }),
      { wrapper, initialProps: { from: "2026-11-01", to: "2026-12-12" } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    for (const [from, to, calls] of [["2026-11-29", "2027-01-09", 2], ["2027-01-31", "2027-03-13", 3]] as const) {
      rerender({ from, to });
      await waitFor(() => expect(listCalendarRows).toHaveBeenCalledTimes(calls));
      await waitFor(() => expect(result.current.isFetching).toBe(false));
      await act(async () => {});
    }
    expect(notifications.show).toHaveBeenCalledTimes(1);
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
