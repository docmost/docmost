import { afterEach, describe, expect, it, vi } from "vitest";

function trackedLoader(name: string, events: string[]) {
  return async () => {
    events.push(`start ${name}`);
    await Promise.resolve();
    events.push(`end ${name}`);
    return { default: () => null };
  };
}

async function freshModule() {
  vi.resetModules();
  return import("./lazy-prefetch");
}

describe("lazy prefetch", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "connection");
    window.history.pushState({}, "", "/");
  });

  it("does not load a component when it is declared", async () => {
    const { lazyWithPrefetch } = await freshModule();
    const load = vi.fn(async () => ({ default: () => null }));

    lazyWithPrefetch(load);

    expect(load).not.toHaveBeenCalled();
  });

  it("loads every declared component one at a time", async () => {
    const { lazyWithPrefetch, prefetchLazyComponents } = await freshModule();
    const events: string[] = [];
    lazyWithPrefetch(trackedLoader("home", events));
    lazyWithPrefetch(trackedLoader("groups", events));

    await prefetchLazyComponents();

    expect(events).toEqual([
      "start home",
      "end home",
      "start groups",
      "end groups",
    ]);
  });

  it("loads components declared by a chunk it prefetched", async () => {
    const { lazyWithPrefetch, prefetchLazyComponents } = await freshModule();
    const events: string[] = [];
    lazyWithPrefetch(async () => {
      events.push("page");
      lazyWithPrefetch(trackedLoader("mermaid", events));
      return { default: () => null };
    });

    await prefetchLazyComponents();

    expect(events).toEqual(["page", "start mermaid", "end mermaid"]);
  });

  it("keeps going when a component fails to load", async () => {
    const { lazyWithPrefetch, prefetchLazyComponents, isPrefetching } =
      await freshModule();
    const later = vi.fn(async () => ({ default: () => null }));
    lazyWithPrefetch(() =>
      Promise.reject(
        new TypeError("Failed to fetch dynamically imported module"),
      ),
    );
    lazyWithPrefetch(later);

    await expect(prefetchLazyComponents()).resolves.toBeUndefined();
    expect(later).toHaveBeenCalledTimes(1);
    expect(isPrefetching()).toBe(false);
  });

  it("reports a prefetch as running only while it runs", async () => {
    const { lazyWithPrefetch, prefetchLazyComponents, isPrefetching } =
      await freshModule();
    let duringPrefetch: boolean | undefined;
    lazyWithPrefetch(async () => {
      duringPrefetch = isPrefetching();
      return { default: () => null };
    });

    await prefetchLazyComponents();

    expect(duringPrefetch).toBe(true);
    expect(isPrefetching()).toBe(false);
  });

  it("does nothing when Data Saver is on", async () => {
    const { lazyWithPrefetch, prefetchLazyComponents } = await freshModule();
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
      configurable: true,
    });
    const load = vi.fn(async () => ({ default: () => null }));
    lazyWithPrefetch(load);

    await prefetchLazyComponents();

    expect(load).not.toHaveBeenCalled();
  });

  it.each([
    "/share/abc123/p/roadmap",
    "/share/p/roadmap",
    "/docs",
    "/docs/handbook/intro",
    "/pdf-render/0199a1b2",
    "/oauth/consent",
  ])("does nothing on %s", async (path) => {
    const { lazyWithPrefetch, prefetchLazyComponents } = await freshModule();
    window.history.pushState({}, "", path);
    const load = vi.fn(async () => ({ default: () => null }));
    lazyWithPrefetch(load);

    await prefetchLazyComponents();

    expect(load).not.toHaveBeenCalled();
  });

  it("prefetches on app pages", async () => {
    const { lazyWithPrefetch, prefetchLazyComponents } = await freshModule();
    window.history.pushState({}, "", "/s/eng/p/roadmap");
    const load = vi.fn(async () => ({ default: () => null }));
    lazyWithPrefetch(load);

    await prefetchLazyComponents();

    expect(load).toHaveBeenCalledTimes(1);
  });
});
