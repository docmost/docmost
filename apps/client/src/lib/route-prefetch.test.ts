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
  return import("./route-prefetch");
}

describe("route prefetch", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "connection");
    window.history.pushState({}, "", "/");
  });

  it("does not load a route when it is declared", async () => {
    const { lazyRoute } = await freshModule();
    const load = vi.fn(async () => ({ default: () => null }));

    lazyRoute(load);

    expect(load).not.toHaveBeenCalled();
  });

  it("loads every declared route one at a time", async () => {
    const { lazyRoute, prefetchRoutes } = await freshModule();
    const events: string[] = [];
    lazyRoute(trackedLoader("home", events));
    lazyRoute(trackedLoader("groups", events));

    await prefetchRoutes();

    expect(events).toEqual([
      "start home",
      "end home",
      "start groups",
      "end groups",
    ]);
  });

  it("keeps going when a route fails to load", async () => {
    const { lazyRoute, prefetchRoutes, isPrefetchingRoutes } =
      await freshModule();
    const later = vi.fn(async () => ({ default: () => null }));
    lazyRoute(() =>
      Promise.reject(
        new TypeError("Failed to fetch dynamically imported module"),
      ),
    );
    lazyRoute(later);

    await expect(prefetchRoutes()).resolves.toBeUndefined();
    expect(later).toHaveBeenCalledTimes(1);
    expect(isPrefetchingRoutes()).toBe(false);
  });

  it("reports a prefetch as running only while it runs", async () => {
    const { lazyRoute, prefetchRoutes, isPrefetchingRoutes } =
      await freshModule();
    let duringPrefetch: boolean | undefined;
    lazyRoute(async () => {
      duringPrefetch = isPrefetchingRoutes();
      return { default: () => null };
    });

    await prefetchRoutes();

    expect(duringPrefetch).toBe(true);
    expect(isPrefetchingRoutes()).toBe(false);
  });

  it("does nothing when Data Saver is on", async () => {
    const { lazyRoute, prefetchRoutes } = await freshModule();
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
      configurable: true,
    });
    const load = vi.fn(async () => ({ default: () => null }));
    lazyRoute(load);

    await prefetchRoutes();

    expect(load).not.toHaveBeenCalled();
  });

  it.each([
    "/share/abc123/p/roadmap",
    "/share/p/roadmap",
    "/docs",
    "/docs/handbook/intro",
    "/pdf-render/0199a1b2",
  ])("does nothing on %s", async (path) => {
    const { lazyRoute, prefetchRoutes } = await freshModule();
    window.history.pushState({}, "", path);
    const load = vi.fn(async () => ({ default: () => null }));
    lazyRoute(load);

    await prefetchRoutes();

    expect(load).not.toHaveBeenCalled();
  });

  it("prefetches on app pages", async () => {
    const { lazyRoute, prefetchRoutes } = await freshModule();
    window.history.pushState({}, "", "/s/eng/p/roadmap");
    const load = vi.fn(async () => ({ default: () => null }));
    lazyRoute(load);

    await prefetchRoutes();

    expect(load).toHaveBeenCalledTimes(1);
  });
});
