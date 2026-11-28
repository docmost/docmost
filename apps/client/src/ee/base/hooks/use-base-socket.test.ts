import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import {
  InfiniteData,
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import type { Socket } from "socket.io-client";
import { baseImportProgressAtomFamily } from "@/ee/base/atoms/base-atoms";
import type { IPagination } from "@/lib/types";
import type { IBase, IBaseRow } from "@/ee/base/types/base.types";
import { referenceStoreAtomFamily } from "@/ee/base/atoms/reference-store-atom";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

vi.mock("@/ee/base/services/base-relation-service", () => ({
  updateRelationLinks: vi.fn(),
}));
vi.mock("@/ee/base/services/base-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ee/base/services/base-service")>()),
  expandRows: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { retainBaseSubscription } = await import("./use-base-socket");
const { updateRelationLinks } = await import("@/ee/base/services/base-relation-service");
const { expandRows } = await import("@/ee/base/services/base-service");
const { useUpdateRelationLinksMutation } = await import("@/ee/base/queries/base-relation-query");

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
    ROWS(pageId),
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

    const rows = queryClient.getQueryData<InfiniteData<IPagination<IBaseRow>>>(ROWS("page-1"));
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

  it("clears import progress missed while away when the subscription is confirmed", () => {
    const { socket, receive } = createFakeSocket();
    const queryClient = new QueryClient();
    const progressAtom = baseImportProgressAtomFamily("page-1");
    getDefaultStore().set(progressAtom, { fileTaskId: "task-1", processedRows: 5, totalRows: 10 });

    const release = retainBaseSubscription(socket, "page-1", queryClient);
    receive({ operation: "base:subscribed", pageId: "page-1", schemaVersion: 1 });

    expect(getDefaultStore().get(progressAtom)).toBeNull();
    release();
  });

  it("refetches the base once when an import succeeds and not when it fails", () => {
    const { socket, receive } = createFakeSocket();
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const completed = {
      operation: "base:import:completed",
      pageId: "page-1",
      fileTaskId: "task-1",
      totalRows: 10,
      actorId: "user-1",
    };

    const release = retainBaseSubscription(socket, "page-1", queryClient);
    receive({ ...completed, status: "failed", importedRows: 0, skippedValues: 0, error: "Nothing was imported." });
    expect(invalidate).not.toHaveBeenCalled();

    receive({ ...completed, status: "success", importedRows: 10, skippedValues: 0, error: null });
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ["base-rows", "page-1"],
      ["bases", "page-1"],
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
    const key = ROWS("page-9");
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

  it("relations updated refetches previews for cached rows only", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const key = ROWS("page-7");
    appClient.setQueryData(key, {
      pages: [{ items: [{ id: "row-1", relations: {} }], meta: {} }],
      pageParams: [null],
    });
    vi.mocked(expandRows).mockReset();
    vi.mocked(expandRows).mockResolvedValue({
      "row-1": { relations: { rel: { count: 1, rows: [{ id: "t1", title: "T1" }] } } },
    });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-7", appClient);
    const event = (rowIds: string[]) => ({
      operation: "base:relations:updated",
      pageId: "page-7",
      rowIds,
      propertyIds: ["rel"],
      actorId: "u2",
      requestId: null,
    });

    receive(event(["not-cached"]));
    await vi.advanceTimersByTimeAsync(200);
    expect(expandRows).not.toHaveBeenCalled();

    receive(event(["row-1", "not-cached"]));
    receive(event(["row-1"]));
    await vi.advanceTimersByTimeAsync(150);
    expect(expandRows).toHaveBeenCalledTimes(1);
    expect(expandRows).toHaveBeenCalledWith("page-7", ["row-1"]);
    const data = appClient.getQueryData<InfiniteData<IPagination<IBaseRow>>>(key)!;
    expect(data.pages[0].items[0].relations?.rel.count).toBe(1);

    release();
  });

  it("own relation edits refresh the other rows the event names", async () => {
    const { queryClient: appClient } = await import("@/main.tsx");
    const key = ROWS("page-14");
    appClient.setQueryData(key, {
      pages: [{ items: [{ id: "row-x", relations: {} }, { id: "row-y", relations: {} }], meta: {} }],
      pageParams: [null],
    });
    vi.mocked(updateRelationLinks).mockReset();
    vi.mocked(updateRelationLinks).mockResolvedValue({
      preview: { count: 1, rows: [{ id: "row-y", title: "Y" }] },
    });
    vi.mocked(expandRows).mockReset();
    vi.mocked(expandRows).mockResolvedValue({
      "row-x": { relations: { rel: { count: 1, rows: [{ id: "row-y", title: "Y" }] } } },
      "row-y": { relations: { inverse: { count: 1, rows: [{ id: "row-x", title: "X" }] } } },
    });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-14", appClient);
    const { result, unmount } = renderHook(() => useUpdateRelationLinksMutation("page-14"), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: appClient }, children),
    });
    try {
      await act(async () => {
        await result.current.mutateAsync({ rowId: "row-x", propertyId: "rel", add: ["row-y"] });
      });
      // the server tags the editing base's event with whatever request id it was sent
      const sent = vi.mocked(updateRelationLinks).mock.calls[0][0];
      receive({
        operation: "base:relations:updated",
        pageId: "page-14",
        rowIds: ["row-x", "row-y"],
        propertyIds: ["rel", "inverse"],
        actorId: "me",
        requestId: sent.requestId ?? null,
      });

      await waitFor(() =>
        expect(expandRows).toHaveBeenCalledWith("page-14", ["row-x", "row-y"]),
      );
      await waitFor(() => {
        const rows = appClient.getQueryData<InfiniteData<IPagination<IBaseRow>>>(key)!.pages[0].items;
        expect(rows[1].relations?.inverse?.count).toBe(1);
      });
    } finally {
      unmount();
      release();
    }
  });

  it("the tab's own link echo skips the edited cell and its list, and refreshes the rest", async () => {
    const { queryClient: appClient } = await import("@/main.tsx");
    const rowsKey = ROWS("page-31");
    const listKey = ["base-relations", "list", "page-31", "row-1", "rel", ""];
    appClient.setQueryData(rowsKey, {
      pages: [{ items: [{ id: "row-1", relations: {} }, { id: "row-2", relations: {} }], meta: {} }],
      pageParams: [null],
    });
    appClient.setQueryData(listKey, { pages: [], pageParams: [] });
    let finishUpdate = () => {};
    vi.mocked(updateRelationLinks).mockReset();
    vi.mocked(updateRelationLinks).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishUpdate = () => resolve({ preview: { count: 0, rows: [] } });
        }),
    );
    vi.mocked(expandRows).mockReset();
    vi.mocked(expandRows).mockResolvedValue({});
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-31", appClient);
    const { result, unmount } = renderHook(() => useUpdateRelationLinksMutation("page-31"), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: appClient }, children),
    });
    try {
      let done: Promise<unknown> = Promise.resolve();
      act(() => {
        done = result.current.mutateAsync({ rowId: "row-1", propertyId: "rel", remove: ["t1"] });
      });
      await waitFor(() => expect(updateRelationLinks).toHaveBeenCalled());
      const sent = vi.mocked(updateRelationLinks).mock.calls[0][0];
      // the echo can land before the response; this one also names a row the change moved
      receive({
        operation: "base:relations:updated",
        pageId: "page-31",
        rowIds: ["row-1", "row-2"],
        propertyIds: ["rel"],
        actorId: "me",
        requestId: sent.requestId ?? null,
      });

      expect(appClient.getQueryState(listKey)?.isInvalidated).toBe(false);
      await waitFor(() => expect(expandRows).toHaveBeenCalledWith("page-31", ["row-2"]));
      expect(expandRows).toHaveBeenCalledTimes(1);
      await act(async () => {
        finishUpdate();
        await done;
      });
    } finally {
      unmount();
      release();
    }
  });

  it("a link edit's stamp sets Last edited on the rows it names, and nothing else does", async () => {
    const { queryClient: appClient } = await import("@/main.tsx");
    const rowsKey = ROWS("page-40");
    const before = { updatedAt: "2026-11-20T09:00:00.000Z", lastUpdatedById: "u1" };
    appClient.setQueryData(rowsKey, {
      pages: [{ items: [{ id: "row-1", cells: {}, ...before }, { id: "row-2", cells: {}, ...before }], meta: {} }],
      pageParams: [null],
    });
    appClient.setQueryData(["base-row", "page-40", "row-1"], { id: "row-1", cells: {}, ...before });
    vi.mocked(expandRows).mockReset();
    vi.mocked(expandRows).mockResolvedValue({});
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-40", appClient);
    const rows = () =>
      appClient.getQueryData<InfiniteData<IPagination<IBaseRow>>>(rowsKey)!.pages[0].items;
    try {
      const stamp = { updatedAt: "2026-11-27T10:00:00.000Z", lastUpdatedById: "u2" };
      receive({
        operation: "base:relations:updated",
        pageId: "page-40",
        rowIds: ["row-1"],
        propertyIds: ["rel"],
        actorId: "u2",
        requestId: null,
        ...stamp,
      });

      expect(rows()[0]).toMatchObject(stamp);
      expect(rows()[1]).toMatchObject(before);
      expect(appClient.getQueryData(["base-row", "page-40", "row-1"])).toMatchObject(stamp);

      // a deleted row's links go without editing the rows that showed them
      receive({
        operation: "base:relations:updated",
        pageId: "page-40",
        rowIds: ["row-2"],
        propertyIds: ["rel"],
        actorId: "u3",
        requestId: null,
      });
      expect(rows()[1]).toMatchObject(before);
    } finally {
      release();
    }
  });

  describe("a link edit that fails after the server saved it", () => {
    const setup = async (pageId: string) => {
      const { queryClient: appClient } = await import("@/main.tsx");
      const listKey = ["base-relations", "list", pageId, "row-1", "rel", ""];
      appClient.setQueryData(ROWS(pageId), {
        pages: [{ items: [{ id: "row-1", relations: { rel: { count: 1, rows: [{ id: "t1", title: "T1" }] } } }], meta: {} }],
        pageParams: [null],
      });
      appClient.setQueryData(listKey, { pages: [], pageParams: [] });
      let failUpdate = () => {};
      vi.mocked(updateRelationLinks).mockReset();
      vi.mocked(updateRelationLinks).mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            failUpdate = () => reject(new Error("timeout of 30000ms exceeded"));
          }),
      );
      vi.mocked(expandRows).mockReset();
      vi.mocked(expandRows).mockResolvedValue({ "row-1": { relations: { rel: { count: 0, rows: [] } } } });
      const { socket, receive } = createFakeSocket();
      const release = retainBaseSubscription(socket, pageId, appClient);
      const { result, unmount } = renderHook(() => useUpdateRelationLinksMutation(pageId), {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client: appClient }, children),
      });
      let done: Promise<unknown> = Promise.resolve();
      act(() => {
        done = result.current
          .mutateAsync({ rowId: "row-1", propertyId: "rel", remove: ["t1"] })
          .catch(() => {});
      });
      await waitFor(() => expect(updateRelationLinks).toHaveBeenCalled());
      const echo = () =>
        receive({
          operation: "base:relations:updated",
          pageId,
          rowIds: ["row-1"],
          propertyIds: ["rel"],
          actorId: "me",
          requestId: vi.mocked(updateRelationLinks).mock.calls[0][0].requestId ?? null,
        });
      const fail = async () => {
        await act(async () => {
          failUpdate();
          await done;
        });
      };
      const cell = () =>
        appClient.getQueryData<InfiniteData<IPagination<IBaseRow>>>(ROWS(pageId))!
          .pages[0].items[0].relations?.rel;
      const listStale = () => appClient.getQueryState(listKey)?.isInvalidated;
      const freshList = () => appClient.setQueryData(listKey, { pages: [], pageParams: [] });
      return { echo, fail, cell, listStale, freshList, cleanup: () => (unmount(), release()) };
    };

    it("refreshes the edited cell and its list when the echo came first", async () => {
      const t = await setup("page-35");
      try {
        t.echo();
        await t.fail();

        await waitFor(() => expect(t.cell()).toEqual({ count: 0, rows: [] }));
        expect(expandRows).toHaveBeenCalledWith("page-35", ["row-1"]);
        expect(t.listStale()).toBe(true);
      } finally {
        t.cleanup();
      }
    });

    it("lets a later echo refresh the edited cell and its list", async () => {
      const t = await setup("page-36");
      try {
        await t.fail();
        vi.mocked(expandRows).mockClear();
        t.freshList();
        t.echo();

        await waitFor(() => expect(expandRows).toHaveBeenCalledWith("page-36", ["row-1"]));
        expect(t.listStale()).toBe(true);
      } finally {
        t.cleanup();
      }
    });
  });

  it("the tab's own echo of a one-cell link edit fetches nothing more", async () => {
    const { queryClient: appClient } = await import("@/main.tsx");
    appClient.setQueryData(ROWS("page-32"), {
      pages: [{ items: [{ id: "row-1", relations: {} }], meta: {} }],
      pageParams: [null],
    });
    vi.mocked(updateRelationLinks).mockReset();
    vi.mocked(updateRelationLinks).mockResolvedValue({ preview: { count: 0, rows: [] } });
    vi.mocked(expandRows).mockReset();
    vi.mocked(expandRows).mockResolvedValue({});
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-32", appClient);
    const { result, unmount } = renderHook(() => useUpdateRelationLinksMutation("page-32"), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: appClient }, children),
    });
    try {
      await act(async () => {
        await result.current.mutateAsync({ rowId: "row-1", propertyId: "rel", remove: ["t1"] });
      });
      const sent = vi.mocked(updateRelationLinks).mock.calls[0][0];
      receive({
        operation: "base:relations:updated",
        pageId: "page-32",
        rowIds: ["row-1"],
        propertyIds: ["rel"],
        actorId: "me",
        requestId: sent.requestId ?? null,
      });

      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(expandRows).not.toHaveBeenCalled();
    } finally {
      unmount();
      release();
    }
  });

  it("relation preview refresh splits into requests of 100", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const ids = Array.from({ length: 250 }, (_, i) => `row-${i}`);
    const key = ROWS("page-17");
    appClient.setQueryData(key, {
      pages: [{ items: ids.map((id) => ({ id, relations: {} })), meta: {} }],
      pageParams: [null],
    });
    vi.mocked(expandRows).mockReset();
    vi.mocked(expandRows).mockImplementation(async (_pageId, rowIds) =>
      Object.fromEntries(rowIds.map((id) => [id, { relations: { rel: { count: 1, rows: [] } } }])),
    );
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-17", appClient);

    receive({
      operation: "base:relations:updated",
      pageId: "page-17",
      rowIds: [...ids, "not-cached"],
      propertyIds: ["rel"],
      actorId: "u2",
      requestId: null,
    });
    await vi.advanceTimersByTimeAsync(150);

    expect(vi.mocked(expandRows).mock.calls.map(([, rowIds]) => rowIds)).toEqual([
      ids.slice(0, 100),
      ids.slice(100, 200),
      ids.slice(200),
    ]);
    const rows = appClient.getQueryData<InfiniteData<IPagination<IBaseRow>>>(key)!.pages[0].items;
    expect(rows.filter((row) => row.relations?.rel?.count === 1)).toHaveLength(250);
    release();
  });

  it("a failed preview refresh falls back to a rows refresh", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const key = ROWS("page-18");
    appClient.setQueryData(key, {
      pages: [{ items: [{ id: "row-1", relations: {} }], meta: {} }],
      pageParams: [null],
    });
    vi.mocked(expandRows).mockReset();
    vi.mocked(expandRows).mockRejectedValue(new Error("Request failed with status code 400"));
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-18", appClient);

    receive({
      operation: "base:relations:updated",
      pageId: "page-18",
      rowIds: ["row-1"],
      propertyIds: ["rel"],
      actorId: "u2",
      requestId: null,
    });
    await vi.advanceTimersByTimeAsync(150);
    expect(expandRows).toHaveBeenCalledTimes(1);
    expect(appClient.getQueryState(key)?.isInvalidated).toBe(false);
    await vi.advanceTimersByTimeAsync(300);
    expect(appClient.getQueryState(key)?.isInvalidated).toBe(true);
    release();
  });

  it("relation updates refresh a deep-linked row", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const key = ["base-row", "page-16", "row-1"];
    appClient.setQueryData(key, { id: "row-1", pageId: "page-16", cells: {}, relations: {} });
    vi.mocked(expandRows).mockReset();
    vi.mocked(expandRows).mockResolvedValue({
      "row-1": { relations: { rel: { count: 1, rows: [{ id: "t1", title: "T1" }] } } },
    });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-16", appClient);

    receive({
      operation: "base:relations:updated",
      pageId: "page-16",
      rowIds: ["row-1", "row-2"],
      propertyIds: ["rel"],
      actorId: "u2",
      requestId: null,
    });
    await vi.advanceTimersByTimeAsync(150);

    expect(expandRows).toHaveBeenCalledWith("page-16", ["row-1"]);
    expect(appClient.getQueryData<IBaseRow>(key)?.relations?.rel.count).toBe(1);
    release();
  });

  it("a created relation property refreshes the base's rows", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const key = ROWS("page-15");
    appClient.setQueryData(key, { pages: [{ items: [{ id: "row-1" }], meta: {} }], pageParams: [null] });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-15", appClient);
    const created = (property: object) => ({
      operation: "base:property:created",
      pageId: "page-15",
      property,
      requestId: null,
    });

    receive(created({ id: "num", type: "number" }));
    vi.advanceTimersByTime(5000);
    expect(appClient.getQueryState(key)?.isInvalidated).toBe(false);

    receive(created({ id: "inverse", type: "relation" }));
    vi.advanceTimersByTime(300);
    expect(appClient.getQueryState(key)?.isInvalidated).toBe(true);
    release();
  });

  it("a relation that starts showing on the other base refreshes the base's rows, a rename doesn't", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const key = ROWS("page-19");
    appClient.setQueryData(key, { pages: [{ items: [{ id: "row-1" }], meta: {} }], pageParams: [null] });
    const relation = (inversePropertyId: string | null, name = "Client") => ({
      id: "rel",
      name,
      type: "relation",
      typeOptions: { relationId: "r1", targetBaseId: "base-2", direction: "source", inversePropertyId },
    });
    appClient.setQueryData(["bases", "page-19"], { id: "page-19", properties: [relation(null)], views: [] });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-19", appClient);
    const updated = (property: object) => ({
      operation: "base:property:updated",
      pageId: "page-19",
      property,
      requestId: null,
    });

    receive(updated(relation(null, "Customer")));
    vi.advanceTimersByTime(5000);
    expect(appClient.getQueryState(key)?.isInvalidated).toBe(false);

    receive(updated(relation("inverse")));
    vi.advanceTimersByTime(300);
    expect(appClient.getQueryState(key)?.isInvalidated).toBe(true);
    release();
  });

  it("a row another user creates gets this viewer's relation previews", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const key = ROWS("page-20");
    appClient.setQueryData(key, {
      pages: [{ items: [{ id: "row-1", cells: {}, relations: {} }], meta: {} }],
      pageParams: [null],
    });
    appClient.setQueryData(["bases", "page-20"], {
      id: "page-20",
      properties: [{ id: "rel", type: "relation" }],
      views: [],
    });
    vi.mocked(expandRows).mockReset();
    vi.mocked(expandRows).mockResolvedValue({
      "row-2": { relations: { rel: { count: 0, rows: [], restricted: true } } },
    });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-20", appClient);

    receive({ operation: "base:row:created", pageId: "page-20", row: { id: "row-2", cells: {} } });
    await vi.advanceTimersByTimeAsync(150);

    expect(expandRows).toHaveBeenCalledWith("page-20", ["row-2"]);
    const rows = appClient.getQueryData<InfiniteData<IPagination<IBaseRow>>>(key)!.pages[0].items;
    expect(rows.find((row) => row.id === "row-2")?.relations?.rel).toMatchObject({ restricted: true });
    release();
  });

  it("a row created in a base without relations asks for no previews", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    appClient.setQueryData(ROWS("page-21"), { pages: [{ items: [], meta: {} }], pageParams: [null] });
    appClient.setQueryData(["bases", "page-21"], {
      id: "page-21",
      properties: [{ id: "name", type: "text" }],
      views: [],
    });
    vi.mocked(expandRows).mockReset();
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-21", appClient);

    receive({ operation: "base:row:created", pageId: "page-21", row: { id: "row-2", cells: {} } });
    await vi.advanceTimersByTimeAsync(5000);

    expect(expandRows).not.toHaveBeenCalled();
    release();
  });

  it("relations updated refreshes an open full list for that row", async () => {
    const queryClient = new QueryClient();
    const listKey = (pageId: string, rowId: string, propertyId: string) => [
      "base-relations",
      "list",
      pageId,
      rowId,
      propertyId,
    ];
    const openList = listKey("page-6", "row-1", "rel");
    const read = vi.fn().mockResolvedValue({ pages: [], pageParams: [] });
    queryClient.setQueryData(openList, { pages: [], pageParams: [] });
    const observer = new QueryObserver(queryClient, {
      queryKey: openList,
      queryFn: read,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    const closedList = listKey("page-6", "row-1", "inverse");
    const otherRow = listKey("page-6", "row-2", "rel");
    const otherBase = listKey("page-other", "row-1", "rel");
    for (const key of [closedList, otherRow, otherBase]) {
      queryClient.setQueryData(key, { pages: [], pageParams: [] });
    }
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-6", queryClient);
    try {
      receive({
        operation: "base:relations:updated",
        pageId: "page-6",
        rowIds: ["row-1"],
        propertyIds: ["rel", "inverse"],
        actorId: "u2",
        requestId: null,
      });
      await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
      expect(queryClient.getQueryState(closedList)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(otherRow)?.isInvalidated).toBe(false);
      expect(queryClient.getQueryState(otherBase)?.isInvalidated).toBe(false);
    } finally {
      release();
      unsubscribe();
    }
  });

  it("drops a pending refresh when the last view of the base leaves", async () => {
    vi.useFakeTimers();
    const { queryClient: appClient } = await import("@/main.tsx");
    const key = ROWS("page-8");
    appClient.setQueryData(key, { pages: [{ items: [{ id: "row-1" }], meta: {} }], pageParams: [null] });
    const { socket, receive } = createFakeSocket();
    const release = retainBaseSubscription(socket, "page-8", appClient);

    receive({ operation: "base:rows:updated", pageId: "page-8", rowIds: ["row-1"], propertyIds: [] });
    release();
    vi.advanceTimersByTime(5000);
    expect(appClient.getQueryState(key)?.isInvalidated).toBe(false);
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

  it("ignores a lastUpdatedById that is a number", () => {
    const { socket, receive } = createFakeSocket();
    const queryClient = new QueryClient();
    seedRow(queryClient, "page-1", stored);
    const release = retainBaseSubscription(socket, "page-1", queryClient);

    receive(edit("page-1", { lastUpdatedById: 42 }));
    expect(rowOf(queryClient, "page-1")).toEqual({ ...stored, cells: { a: 2 } });
    release();
  });

  it("applies a remote edit to a row cached under a calendar window and leaves another base's row alone", () => {
    const { socket, receive } = createFakeSocket();
    const queryClient = new QueryClient();
    queryClient.setQueryData(["bases", "page-1"], {
      properties: [{ id: "prop-1", type: "date" }], views: [],
    });
    const windowKey = (pageId: string) => ["base-rows", pageId, "calendar", "prop-1", "2026-11-01", "2026-11-30", undefined, undefined];
    const seedWindow = (pageId: string) =>
      queryClient.setQueryData(windowKey(pageId), { pages: [{ items: [stored], meta: {} }], pageParams: [null] });
    seedWindow("page-1");
    seedWindow("page-2");
    const otherBefore = queryClient.getQueryData(windowKey("page-2"));
    const release = retainBaseSubscription(socket, "page-1", queryClient);

    receive(edit("page-1", { updatedAt: "2026-11-12T11:30:00.000Z", lastUpdatedById: "u2" }));
    const windowRows = queryClient.getQueryData<InfiniteData<IPagination<IBaseRow>>>(windowKey("page-1"))!;
    expect(windowRows.pages[0].items[0]).toEqual({
      id: "row-1",
      cells: { a: 2 },
      updatedAt: "2026-11-12T11:30:00.000Z",
      lastUpdatedById: "u2",
    });
    expect(queryClient.getQueryData(windowKey("page-2"))).toBe(otherBefore);
    expect(queryClient.getQueryData<InfiniteData<IPagination<IBaseRow>>>(windowKey("page-2"))!.pages[0].items[0]).toEqual(stored);
    release();
  });

  it("refreshes a filtered calendar after another user creates and then moves an event", async () => {
    vi.useFakeTimers();
    const { queryClient } = await import("@/main.tsx");
    const { socket, receive } = createFakeSocket();
    const pageId = "shared-calendar";
    const filter = { propertyId: "name", op: "eq", value: "Launch" };
    const queryKey = ["base-rows", pageId, "calendar", "due", "2026-11-01", "2026-11-30", filter];
    queryClient.setQueryData(["bases", pageId], {
      properties: [{ id: "due", type: "date" }, { id: "name", type: "text" }], views: [],
    });
    const row = { id: "r1", cells: { due: { start: "2026-12-01" }, name: "Launch" } };
    const moved = { ...row, cells: { ...row.cells, due: { start: "2026-11-19" } } };
    const rows = (items: (typeof row)[]) => ({
      pages: [{ items, meta: { total: items.length } }], pageParams: [null],
    });
    const read = vi.fn().mockResolvedValueOnce(rows([])).mockResolvedValue(rows([moved]));
    queryClient.setQueryData(queryKey, rows([]));
    const observer = new QueryObserver(queryClient, { queryKey, queryFn: read, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    const release = retainBaseSubscription(socket, pageId, queryClient);
    try {
      receive({ operation: "base:row:created", pageId, row });
      expect(queryClient.getQueryData(queryKey)).toEqual(rows([]));
      await vi.advanceTimersByTimeAsync(300);
      expect(read).toHaveBeenCalledTimes(1);

      receive({ operation: "base:row:updated", pageId, rowId: row.id, updatedCells: { due: moved.cells.due } });
      await vi.advanceTimersByTimeAsync(2000);
      expect(read).toHaveBeenCalledTimes(2);
      expect(queryClient.getQueryData(queryKey)).toEqual(rows([moved]));
    } finally {
      release();
      unsubscribe();
      queryClient.clear();
    }
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

    const linkStamp = (extra: object = {}) => ({
      operation: "base:relations:updated",
      pageId,
      rowIds: ["row-2"],
      propertyIds: ["rel"],
      actorId: "u2",
      requestId: null,
      ...extra,
    });
    const stamped = { updatedAt: "2026-11-27T10:00:00.000Z", lastUpdatedById: "u2" };
    const withProperty = (property: object) => ({ ...base, properties: [...base.properties, property] });

    it("refreshes all rows once when a link edit stamps a row under a list sorted by Last edited", async () => {
      const { receive, allRowsRefreshes, appClient } = await observeList(undefined, [
        { propertyId: "prpedited001", direction: "desc" },
      ]);
      appClient.setQueryData(["bases", pageId], withProperty({ id: "prpedited001", type: "lastEditedAt" }));
      receive(linkStamp(stamped));
      expect(allRowsRefreshes()).toBe(1);
    });

    it("refreshes nothing for a link change that stamps no row", async () => {
      const { receive, allRowsRefreshes, appClient } = await observeList(undefined, [
        { propertyId: "prpedited001", direction: "desc" },
      ]);
      appClient.setQueryData(["bases", pageId], withProperty({ id: "prpedited001", type: "lastEditedAt" }));
      receive(linkStamp());
      expect(allRowsRefreshes()).toBe(0);
    });

    const filterOnRelation = { op: "and", children: [{ propertyId: "rel", op: "isEmpty" }] };
    const withRelation = () => withProperty({ id: "rel", type: "relation" });

    it("refreshes all rows once when links change on a relation the list filters by", async () => {
      const { receive, allRowsRefreshes, appClient } = await observeList(filterOnRelation, undefined);
      appClient.setQueryData(["bases", pageId], withRelation());
      receive(linkStamp(stamped));
      expect(allRowsRefreshes()).toBe(1);
    });

    it("refreshes all rows once when a deleted row's links go under a list filtered by that relation", async () => {
      const { receive, allRowsRefreshes, appClient } = await observeList(filterOnRelation, undefined);
      appClient.setQueryData(["bases", pageId], withRelation());
      receive(linkStamp());
      expect(allRowsRefreshes()).toBe(1);
    });

    it("refreshes nothing for a link change on a relation the list doesn't use", async () => {
      const { receive, allRowsRefreshes, appClient } = await observeList(filterOnText, undefined);
      appClient.setQueryData(["bases", pageId], withRelation());
      receive(linkStamp(stamped));
      expect(allRowsRefreshes()).toBe(0);
    });

    it("refreshes a calendar window filtered by a relation when its links change", async () => {
      const { receive, appClient } = await observeList(undefined, undefined);
      appClient.setQueryData(["bases", pageId], withRelation());
      const windowKey = ["base-rows", pageId, "calendar", "prpdue0000001", "2026-11-01", "2026-11-30", filterOnRelation];
      appClient.setQueryData(windowKey, { items: [], total: 0 });
      const observer = new QueryObserver(appClient, { queryKey: windowKey, queryFn: () => new Promise(() => {}), staleTime: Infinity });
      unsubscribes.push(observer.subscribe(() => {}));
      receive(linkStamp());
      expect(appClient.getQueryState(windowKey)?.isInvalidated).toBe(true);
    });

    it("refreshes all rows once when the link editor is not known yet and Last edited by shows", async () => {
      const { receive, allRowsRefreshes, appClient } = await observeList(undefined, undefined);
      appClient.setQueryData(["bases", pageId], withProperty({ id: "prpeditor001", type: "lastEditedBy" }));
      receive(linkStamp({ ...stamped, actorId: "u9", lastUpdatedById: "u9" }));
      expect(allRowsRefreshes()).toBe(1);
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
