import { describe, expect, it, vi } from "vitest";
import { InfiniteData, QueryClient } from "@tanstack/react-query";
import { getDefaultStore } from "jotai";
import type { Socket } from "socket.io-client";
import { baseImportProgressAtomFamily } from "@/ee/base/atoms/base-atoms";
import type { IPagination } from "@/lib/types";
import type { IBaseRow } from "@/ee/base/types/base.types";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

const { retainBaseSubscription } = await import("./use-base-socket");

function createFakeSocket() {
  const handlers = new Set<(raw: unknown) => void>();
  const emitted: unknown[] = [];
  const socket = {
    on: vi.fn((_event: string, handler: (raw: unknown) => void) => {
      handlers.add(handler);
      return socket;
    }),
    off: vi.fn((_event: string, handler: (raw: unknown) => void) => {
      handlers.delete(handler);
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

describe("retainBaseSubscription", () => {
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
});
