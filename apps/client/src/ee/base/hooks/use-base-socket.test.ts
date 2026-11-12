import { afterEach, describe, expect, it, vi } from "vitest";
import { InfiniteData, QueryClient, QueryObserver } from "@tanstack/react-query";
import { getDefaultStore } from "jotai";
import type { Socket } from "socket.io-client";
import type { IPagination } from "@/lib/types";
import type { IBase, IBaseRow } from "@/ee/base/types/base.types";
import { referenceStoreAtomFamily } from "@/ee/base/atoms/reference-store-atom";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

const { retainBaseSubscription } = await import("./use-base-socket");

function createFakeSocket() {
  const listeners = new Map<string, Set<(raw: unknown) => void>>();
  const listenersFor = (event: string) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    return listeners.get(event)!;
  };
  const handlers = listenersFor("message");
  const emitted: unknown[] = [];
  const socket = {
    connected: true,
    on: vi.fn((event: string, handler: (raw: unknown) => void) => {
      listenersFor(event).add(handler);
      return socket;
    }),
    off: vi.fn((event: string, handler: (raw: unknown) => void) => {
      listenersFor(event).delete(handler);
      return socket;
    }),
    emit: vi.fn((_event: string, payload: unknown) => {
      emitted.push(payload);
      return socket;
    }),
  };
  return {
    socket: socket as unknown as Socket,
    handlers,
    emitted,
    receive: (raw: unknown) => handlers.forEach((handler) => handler(raw)),
  };
}

function seedRows(queryClient: QueryClient, pageId: string) {
  queryClient.setQueryData<InfiniteData<IPagination<IBaseRow>>>(
    ["base-rows", pageId, "view-1"],
    { pages: [{ items: [], meta: {} } as IPagination<IBaseRow>], pageParams: [null] },
  );
}

const ROWS = (pageId: string) => ["base-rows", pageId, undefined, undefined, undefined];
const seedRow = (client: QueryClient, pageId: string, row: object) =>
  client.setQueryData(ROWS(pageId), { pages: [{ items: [row], meta: {} }], pageParams: [null] });
const rowOf = (client: QueryClient, pageId: string) =>
  client.getQueryData<InfiniteData<IPagination<IBaseRow>>>(ROWS(pageId))!.pages[0].items[0];
const stored = { id: "row-1", cells: { a: 1 }, updatedAt: "2026-11-12T10:00:00.000Z", lastUpdatedById: "u1" };
const edit = (pageId: string, extra: object = {}) => ({
  operation: "base:row:updated",
  pageId,
  rowId: "row-1",
  updatedCells: { a: 2 },
  ...extra,
});

describe("retainBaseSubscription", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("joins the base room once for several views and leaves after the last one", () => {
    const { socket, emitted, handlers } = createFakeSocket();
    const queryClient = new QueryClient();

    const releaseFirst = retainBaseSubscription(socket, "page-1", queryClient);
    const releaseSecond = retainBaseSubscription(socket, "page-1", queryClient);
    expect(emitted).toEqual([{ operation: "base:subscribe", pageId: "page-1" }]);
    expect(handlers.size).toBe(1);

    releaseFirst();
    expect(emitted).toHaveLength(1);
    expect(handlers.size).toBe(1);

    releaseSecond();
    expect(emitted).toEqual([
      { operation: "base:subscribe", pageId: "page-1" },
      { operation: "base:unsubscribe", pageId: "page-1" },
    ]);
    expect(handlers.size).toBe(0);
  });

  it("applies a created row once while two views of the base are mounted", () => {
    const { socket, receive } = createFakeSocket();
    const queryClient = new QueryClient();
    seedRows(queryClient, "page-1");

    const releaseFirst = retainBaseSubscription(socket, "page-1", queryClient);
    const releaseSecond = retainBaseSubscription(socket, "page-1", queryClient);
    receive({ operation: "base:row:created", pageId: "page-1", row: { id: "row-1" } });

    const rows = queryClient.getQueryData<InfiniteData<IPagination<IBaseRow>>>([
      "base-rows",
      "page-1",
      "view-1",
    ]);
    expect(rows.pages[0].items.map((row) => row.id)).toEqual(["row-1"]);

    releaseFirst();
    releaseSecond();
  });

  it("subscribes again when a view mounts after the last one left", () => {
    const { socket, emitted } = createFakeSocket();
    const queryClient = new QueryClient();

    retainBaseSubscription(socket, "page-1", queryClient)();
    const release = retainBaseSubscription(socket, "page-1", queryClient);

    expect(emitted).toEqual([
      { operation: "base:subscribe", pageId: "page-1" },
      { operation: "base:unsubscribe", pageId: "page-1" },
      { operation: "base:subscribe", pageId: "page-1" },
    ]);
    release();
  });

  it("keeps separate subscriptions per base", () => {
    const { socket, emitted } = createFakeSocket();
    const queryClient = new QueryClient();

    const releaseFirst = retainBaseSubscription(socket, "page-1", queryClient);
    const releaseSecond = retainBaseSubscription(socket, "page-2", queryClient);
    releaseFirst();

    expect(emitted).toEqual([
      { operation: "base:subscribe", pageId: "page-1" },
      { operation: "base:subscribe", pageId: "page-2" },
      { operation: "base:unsubscribe", pageId: "page-1" },
    ]);
    releaseSecond();
  });

  it("refreshes all rows once, 300 ms after batch updates that touch a loaded row", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const key = ["base-rows", "page-9", "view-1"];
    appClient.setQueryData(key, { pages: [{ items: [{ id: "row-1" }], meta: {} }], pageParams: [null] });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-9", appClient);

    receive({ operation: "base:rows:updated", pageId: "page-9", rowIds: ["row-1"], propertyIds: [] });
    receive({ operation: "base:rows:updated", pageId: "page-9", rowIds: ["row-1"], propertyIds: [] });
    expect(appClient.getQueryState(key)?.isInvalidated).toBe(false);
    vi.advanceTimersByTime(300);
    expect(appClient.getQueryState(key)?.isInvalidated).toBe(true);

    release();
  });

  it("drops a pending refresh when the last view of the base leaves", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const key = ["base-rows", "page-8", "view-1"];
    appClient.setQueryData(key, { pages: [{ items: [{ id: "row-1" }], meta: {} }], pageParams: [null] });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-8", appClient);

    receive({ operation: "base:rows:updated", pageId: "page-8", rowIds: ["row-1"], propertyIds: [] });
    release();
    vi.advanceTimersByTime(5000);
    expect(appClient.getQueryState(key)?.isInvalidated).toBe(false);
  });

  it("takes a changed base time zone into the cached base and refreshes its rows", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const rowsKey = ["base-rows", "page-4", "view-1"];
    appClient.setQueryData(["bases", "page-4"], { id: "page-4", baseTimeZone: null, properties: [{ id: "p1" }], views: [] });
    appClient.setQueryData(rowsKey, { pages: [{ items: [], meta: {} }], pageParams: [null] });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-4", appClient);

    receive({ operation: "base:updated", pageId: "page-4", baseTimeZone: "Europe/Berlin" });
    expect(appClient.getQueryData(["bases", "page-4"])).toEqual({
      id: "page-4",
      baseTimeZone: "Europe/Berlin",
      properties: [{ id: "p1" }],
      views: [],
    });
    vi.advanceTimersByTime(300);
    expect(appClient.getQueryState(rowsKey)?.isInvalidated).toBe(true);

    release();
    vi.useRealTimers();
  });

  it("does not refresh rows for a base:updated that names the zone it already has", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const rowsKey = ["base-rows", "page-6", "view-1"];
    appClient.setQueryData(["bases", "page-6"], { id: "page-6", baseTimeZone: "Europe/Berlin", properties: [], views: [] });
    appClient.setQueryData(rowsKey, { pages: [{ items: [], meta: {} }], pageParams: [null] });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-6", appClient);

    receive({ operation: "base:updated", pageId: "page-6", baseTimeZone: "Europe/Berlin" });
    vi.advanceTimersByTime(5000);
    expect(appClient.getQueryState(rowsKey)?.isInvalidated).toBe(false);

    release();
    vi.useRealTimers();
  });

  it("ignores base:updated for a base that is not loaded", () => {
    const { socket, receive } = createFakeSocket();
    const queryClient = new QueryClient();
    const release = retainBaseSubscription(socket, "page-5", queryClient);

    receive({ operation: "base:updated", pageId: "page-5", baseTimeZone: "Europe/Berlin" });
    expect(queryClient.getQueryData(["bases", "page-5"])).toBeUndefined();

    release();
  });

  it("takes Last edited at and Last edited by from a remote edit", () => {
    const { socket, receive } = createFakeSocket();
    const queryClient = new QueryClient();
    seedRow(queryClient, "page-1", stored);
    const release = retainBaseSubscription(socket, "page-1", queryClient);

    receive(edit("page-1", { updatedAt: "2026-11-12T11:30:00.000Z", lastUpdatedById: "u2" }));
    expect(rowOf(queryClient, "page-1")).toEqual({
      id: "row-1",
      cells: { a: 2 },
      updatedAt: "2026-11-12T11:30:00.000Z",
      lastUpdatedById: "u2",
    });

    receive(edit("page-1", { updatedAt: "2026-11-12T11:45:00.000Z", lastUpdatedById: null }));
    expect(rowOf(queryClient, "page-1")).toMatchObject({ updatedAt: "2026-11-12T11:45:00.000Z", lastUpdatedById: null });
    release();
  });

  it("leaves both as they were when the event does not carry them", () => {
    const { socket, receive } = createFakeSocket();
    const queryClient = new QueryClient();
    seedRow(queryClient, "page-1", stored);
    const release = retainBaseSubscription(socket, "page-1", queryClient);

    receive(edit("page-1"));
    expect(rowOf(queryClient, "page-1")).toEqual({ ...stored, cells: { a: 2 } });
    release();
  });

  it("ignores an updatedAt that is not text", () => {
    const { socket, receive } = createFakeSocket();
    const queryClient = new QueryClient();
    seedRow(queryClient, "page-1", stored);
    const release = retainBaseSubscription(socket, "page-1", queryClient);

    receive(edit("page-1", { updatedAt: 1731411000000 }));
    expect(rowOf(queryClient, "page-1").updatedAt).toBe("2026-11-12T10:00:00.000Z");
    release();
  });

  it("asks for the rows again when the base shows Last edited by and the editor is not known yet", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    appClient.setQueryData(["bases", "page-12"], { id: "page-12", properties: [{ id: "by", type: "lastEditedBy" }], views: [] });
    seedRow(appClient, "page-12", stored);
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-12", appClient);

    receive(edit("page-12", { updatedAt: "2026-11-12T11:30:00.000Z", lastUpdatedById: "u9" }));
    expect(rowOf(appClient, "page-12").lastUpdatedById).toBe("u9");
    vi.advanceTimersByTime(300);
    expect(appClient.getQueryState(ROWS("page-12"))?.isInvalidated).toBe(true);

    release();
    vi.useRealTimers();
  });

  it("does not ask again when the editor is already known", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    appClient.setQueryData(["bases", "page-13"], { id: "page-13", properties: [{ id: "by", type: "lastEditedBy" }], views: [] });
    seedRow(appClient, "page-13", stored);
    getDefaultStore().set(referenceStoreAtomFamily("page-13"), {
      users: { u2: { id: "u2", name: "Ada", avatarUrl: null } },
      pages: {},
    });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-13", appClient);

    receive(edit("page-13", { updatedAt: "2026-11-12T11:30:00.000Z", lastUpdatedById: "u2" }));
    vi.advanceTimersByTime(5000);
    expect(appClient.getQueryState(ROWS("page-13"))?.isInvalidated).toBe(false);

    release();
    vi.useRealTimers();
  });

  describe("another user's change under a sorted or filtered list", () => {
    const pageId = "page-7";
    const base = {
      id: pageId,
      properties: [
        { id: "prpdue0000001", type: "date" },
        { id: "prptext000001", type: "text" },
      ],
      views: [{ id: "view-1", type: "table" }],
    } as unknown as IBase;
    const unsubscribes: (() => void)[] = [];

    const observeList = async (filter: unknown, sorts: unknown) => {
      vi.useFakeTimers();
      const { queryClient: appClient } = await import("@/main.tsx");
      const key = ["base-rows", pageId, filter, sorts, undefined];
      appClient.setQueryData(key, { pages: [{ items: [{ id: "row-1", cells: {} }], meta: {} }], pageParams: [null] });
      const observer = new QueryObserver(appClient, { queryKey: key, queryFn: () => new Promise(() => {}), staleTime: Infinity });
      unsubscribes.push(observer.subscribe(() => {}));
      appClient.setQueryData(["bases", pageId], base);
      const { socket, receive } = createFakeSocket();
      unsubscribes.push(retainBaseSubscription(socket, pageId, appClient));
      const invalidate = vi.spyOn(appClient, "invalidateQueries");
      const allRowsRefreshes = () => {
        vi.advanceTimersByTime(5000);
        return invalidate.mock.calls.filter(([filters]) => filters?.queryKey?.length === 2).length;
      };
      return { receive, allRowsRefreshes, appClient };
    };

    afterEach(async () => {
      unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
      const { queryClient: appClient } = await import("@/main.tsx");
      appClient.clear();
      vi.restoreAllMocks();
    });

    const sortOnDue = [{ propertyId: "prpdue0000001", direction: "asc" }];
    const filterOnText = { op: "and", children: [{ propertyId: "prptext000001", op: "contains", value: "a" }] };

    it("refreshes all rows once when a sorted property changed", async () => {
      const { receive, allRowsRefreshes } = await observeList(undefined, sortOnDue);
      receive({ operation: "base:row:updated", pageId, rowId: "row-1", updatedCells: { prpdue0000001: { start: "2026-11-12" } } });
      expect(allRowsRefreshes()).toBe(1);
    });

    it("refreshes nothing when an unrelated property changed", async () => {
      const { receive, allRowsRefreshes } = await observeList(undefined, sortOnDue);
      receive({ operation: "base:row:updated", pageId, rowId: "row-1", updatedCells: { prptext000001: "x" } });
      expect(allRowsRefreshes()).toBe(0);
    });

    it("refreshes all rows once for a created row under a filtered list", async () => {
      const { receive, allRowsRefreshes } = await observeList(filterOnText, undefined);
      receive({ operation: "base:row:created", pageId, row: { id: "row-2", cells: {} } });
      expect(allRowsRefreshes()).toBe(1);
    });

    it("refreshes nothing for a created row under an unsorted, unfiltered list", async () => {
      const { receive, allRowsRefreshes } = await observeList(undefined, undefined);
      receive({ operation: "base:row:created", pageId, row: { id: "row-2", cells: {} } });
      expect(allRowsRefreshes()).toBe(0);
    });

    it("refreshes all rows once when the base has a board", async () => {
      const { receive, allRowsRefreshes, appClient } = await observeList(undefined, sortOnDue);
      appClient.setQueryData(["bases", pageId], { ...base, views: [{ id: "view-2", type: "kanban" }] });
      receive({ operation: "base:row:updated", pageId, rowId: "row-1", updatedCells: { prpdue0000001: { start: "2026-11-12" } } });
      expect(allRowsRefreshes()).toBe(1);
    });
  });
});
