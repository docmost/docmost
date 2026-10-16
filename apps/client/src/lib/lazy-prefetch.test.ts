import { createElement, Suspense } from "react";
import { cleanup, render, screen } from "@testing-library/react";
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
    cleanup();
    Reflect.deleteProperty(navigator, "connection");
    Reflect.deleteProperty(navigator, "onLine");
    window.history.pushState({}, "", "/");
    document.head.querySelectorAll("link").forEach((link) => link.remove());
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

  it("loads a component marked prefetchFirst before the rest", async () => {
    const { lazyWithPrefetch, prefetchLazyComponents } = await freshModule();
    const events: string[] = [];
    lazyWithPrefetch(trackedLoader("home", events));
    lazyWithPrefetch(trackedLoader("page", events), { prefetchFirst: true });

    await prefetchLazyComponents();

    expect(events).toEqual([
      "start page",
      "end page",
      "start home",
      "end home",
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

  it("stops at the first component that fails to load", async () => {
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
    await prefetchLazyComponents();

    expect(later).not.toHaveBeenCalled();
    expect(isPrefetching()).toBe(false);
  });

  it("runs only once when started again", async () => {
    const { lazyWithPrefetch, prefetchLazyComponents } = await freshModule();
    const events: string[] = [];
    lazyWithPrefetch(trackedLoader("home", events));
    lazyWithPrefetch(trackedLoader("groups", events));

    await Promise.all([prefetchLazyComponents(), prefetchLazyComponents()]);

    expect(events).toEqual([
      "start home",
      "end home",
      "start groups",
      "end groups",
    ]);
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

  it("retries a stylesheet that failed during the prefetch before rendering a component", async () => {
    const { lazyWithPrefetch, prefetchLazyComponents } = await freshModule();
    const href = `${window.location.origin}/assets/groups.css`;
    const failed = document.createElement("link");
    lazyWithPrefetch(async () => {
      failed.rel = "stylesheet";
      failed.href = href;
      document.head.appendChild(failed);
      failed.dispatchEvent(new Event("error"));
      throw new Error(`Unable to preload CSS for ${href}`);
    });
    const Groups = lazyWithPrefetch(async () => ({
      default: () => createElement("p", null, "Groups"),
    }));
    await prefetchLazyComponents();

    render(createElement(Suspense, { fallback: null }, createElement(Groups)));
    const retry = await vi.waitFor(() => {
      const link = document.head.querySelector(`link[href="${href}"]`);
      expect(link).not.toBe(failed);
      return link;
    });

    expect(failed.isConnected).toBe(false);
    expect(screen.queryByText("Groups")).toBeNull();
    retry.dispatchEvent(new Event("load"));
    expect(await screen.findByText("Groups")).toBeTruthy();
  });

  it("does nothing while offline", async () => {
    const { lazyWithPrefetch, prefetchLazyComponents } = await freshModule();
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    const load = vi.fn(async () => ({ default: () => null }));
    lazyWithPrefetch(load);

    await prefetchLazyComponents();

    expect(load).not.toHaveBeenCalled();
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
