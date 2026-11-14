import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { usePageYdoc } from "./use-page-ydoc";

const { FakeIndexeddbPersistence, persistences } = vi.hoisted(() => {
  const persistences: any[] = [];

  // Same surface as the real class: `db` is set once the open promise resolves,
  // `whenSynced` resolves once the stored updates were applied.
  class FakeIndexeddbPersistence {
    db: object | null = null;
    synced = false;
    whenSynced: Promise<unknown>;
    _db: Promise<object>;
    destroy = vi.fn(() => Promise.resolve());
    private resolveDb!: (db: object) => void;
    private rejectDb!: (error: Error) => void;
    private resolveSynced!: (self: unknown) => void;

    constructor(
      public name: string,
      public doc: unknown,
    ) {
      this._db = new Promise((resolve, reject) => {
        this.resolveDb = resolve;
        this.rejectDb = reject;
      });
      this.whenSynced = new Promise((resolve) => {
        this.resolveSynced = resolve;
      });
      this._db.then(
        (db) => {
          this.db = db;
        },
        () => {},
      );
      persistences.push(this);
    }

    open() {
      this.resolveDb({});
    }

    load() {
      this.synced = true;
      this.resolveSynced(this);
    }

    fail(error: Error) {
      this.rejectDb(error);
    }
  }

  return { FakeIndexeddbPersistence, persistences };
});

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: FakeIndexeddbPersistence,
}));

beforeEach(() => {
  vi.useFakeTimers();
  persistences.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePageYdoc", () => {
  it("returns the document only after the local copy has loaded", async () => {
    const { result } = renderHook(() => usePageYdoc("page-1"));

    expect(result.current).toBeNull();
    expect(persistences).toHaveLength(1);
    expect(persistences[0].name).toBe("page.page-1");

    await act(async () => persistences[0].open());
    expect(result.current).toBeNull();

    await act(async () => persistences[0].load());
    expect(result.current).toBeInstanceOf(Y.Doc);
    expect(result.current).toBe(persistences[0].doc);
  });

  it("returns the document when the database cannot be opened", async () => {
    const { result } = renderHook(() => usePageYdoc("page-1"));

    await act(async () => persistences[0].fail(new Error("blocked")));

    expect(result.current).toBe(persistences[0].doc);
  });

  it("returns the document when the database never opens", () => {
    const { result } = renderHook(() => usePageYdoc("page-1"));

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBeNull();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(persistences[0].doc);
  });

  it("keeps waiting for a database that opened but is still loading", async () => {
    const { result } = renderHook(() => usePageYdoc("page-1"));

    await act(async () => persistences[0].open());
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBeNull();

    await act(async () => persistences[0].load());
    expect(result.current).toBe(persistences[0].doc);
  });

  it("never returns another page's document", async () => {
    const returned: [string, Y.Doc | null][] = [];
    const { rerender } = renderHook(
      ({ pageId }) => {
        const ydoc = usePageYdoc(pageId);
        returned.push([pageId, ydoc]);
        return ydoc;
      },
      { initialProps: { pageId: "page-1" } },
    );
    await act(async () => {
      persistences[0].open();
      persistences[0].load();
    });
    const firstDoc = persistences[0].doc;
    expect(returned.at(-1)).toEqual(["page-1", firstDoc]);

    rerender({ pageId: "page-2" });
    await act(async () => {
      persistences[1].open();
      persistences[1].load();
    });

    expect(persistences[1].name).toBe("page.page-2");
    expect(persistences[1].doc).not.toBe(firstDoc);
    const forSecondPage = returned
      .filter(([pageId]) => pageId === "page-2")
      .map(([, ydoc]) => ydoc);
    expect(forSecondPage).not.toContain(firstDoc);
    expect(forSecondPage.at(-1)).toBe(persistences[1].doc);
  });

  it("closes the local copy when the page is left", async () => {
    const { result, unmount } = renderHook(() => usePageYdoc("page-1"));
    await act(async () => persistences[0].open());

    unmount();
    await act(async () => persistences[0].load());

    expect(persistences[0].destroy).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();
  });
});
