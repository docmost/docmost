import { act, cleanup, renderHook } from "@testing-library/react";
import * as Y from "yjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePageYdoc } from "./use-page-ydoc";

const { caches } = vi.hoisted(() => ({ caches: [] as any[] }));
vi.mock("./page-draft-cache", () => ({
  PageDraftCache: class {
    ydoc = new Y.Doc();
    opened = false;
    close = vi.fn();
    useBackupStorage = vi.fn();
    resumeDrafts = vi.fn(async () => {});
    resolve!: (cached: boolean) => void;
    reject!: (error: Error) => void;
    restore = vi.fn(
      () =>
        new Promise<boolean>((resolve, reject) => {
          this.resolve = resolve;
          this.reject = reject;
        }),
    );
    discard = vi.fn(async () => {});
    constructor(
      public pageId: string,
      public userId: string,
    ) {
      caches.push(this);
    }
  },
}));

const report = vi.fn();
const mount = () => renderHook(() => usePageYdoc("page", "user", report));
beforeEach(() => {
  vi.useFakeTimers();
  caches.length = 0;
  report.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("usePageYdoc", () => {
  it.each([false, true])(
    "publishes the restored document and its cached status (%s)",
    async (cached) => {
      const { result } = mount();
      expect(result.current).toBeNull();
      await act(async () => caches[0].resolve(cached));
      expect(result.current?.ydoc).toBe(caches[0].ydoc);
      expect(result.current?.hasCachedDocument).toBe(cached);
    },
  );

  it("recovers once from a rejection and requests server state before editing again", async () => {
    const { result } = mount();
    await act(async () => caches[0].resolve(true));
    const first = result.current!;
    await act(async () => {
      expect(first.discardRejectedChanges()).toBe(true);
      expect(first.discardRejectedChanges()).toBe(false);
    });
    expect(caches[0].discard).toHaveBeenCalledTimes(1);
    expect(caches[0].close).toHaveBeenCalledOnce();
    expect(result.current).toBeNull();
    expect(caches[1].restore).toHaveBeenCalledWith(true);
    await act(async () => caches[1].resolve(false));
    expect(result.current?.hasCachedDocument).toBe(false);
    expect(result.current?.ydoc).not.toBe(first.ydoc);
  });

  it("finishes a rollback after navigation without reopening the old page", async () => {
    let finish!: () => void;
    const { result, unmount } = mount();
    caches[0].discard.mockImplementation(
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    );
    await act(async () => caches[0].resolve(true));
    act(() => {
      result.current!.discardRejectedChanges();
    });
    unmount();
    expect(caches[0].close).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(caches[0].close).toHaveBeenCalledOnce();
    expect(caches).toHaveLength(1);
  });

  it("waits for an open database and falls back when storage fails", async () => {
    const { result } = mount();
    caches[0].opened = true;
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBeNull();
    await act(async () => caches[0].reject(new Error("storage failed")));
    expect(result.current?.hasCachedDocument).toBe(false);
    expect(result.current?.cache).toBe(caches[1]);
    expect(caches[1].useBackupStorage).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledOnce();
  });

  it("uses server state when the database never opens and ignores a late restore", async () => {
    const { result } = mount();
    act(() => vi.advanceTimersByTime(5000));
    const server = result.current!;
    expect(server.ydoc).not.toBe(caches[0].ydoc);
    await act(async () => caches[0].resolve(true));
    expect(result.current).toBe(server);
  });

  it("uses the server when a transaction stalls after the database opens", async () => {
    const { result } = mount();
    caches[0].opened = true;
    act(() => vi.advanceTimersByTime(10_000));
    const live = result.current!;
    live.ydoc.getText("text").insert(0, "live changes");
    await act(async () => caches[0].resolve(true));
    expect(result.current).toBe(live);
    expect(live.ydoc.getText("text").toString()).toBe("live changes");
    expect(report).toHaveBeenCalledOnce();
  });

  it("never exposes a previous page or account's editor", async () => {
    const { result, rerender } = renderHook(
      ({ page, user }) => usePageYdoc(page, user, report),
      { initialProps: { page: "a", user: "one" } },
    );
    await act(async () => caches[0].resolve(true));
    rerender({ page: "a", user: "two" });
    expect(result.current).toBeNull();
    rerender({ page: "b", user: "two" });
    await act(async () => {
      caches[1].resolve(true);
      caches[2].resolve(true);
    });
    expect(result.current?.ydoc).toBe(caches[2].ydoc);
    expect(caches[0].close).toHaveBeenCalledOnce();
  });
});
