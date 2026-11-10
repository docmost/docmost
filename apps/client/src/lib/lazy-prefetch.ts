import { ComponentType, lazy } from "react";

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

type LazyWithPrefetchOptions = {
  prefetchFirst?: boolean;
};

const prefetchQueue: Array<() => Promise<unknown>> = [];
// Vite never requests a stylesheet twice, so one that fails during the prefetch stays missing until retried here
const failedStylesheets = new Set<HTMLLinkElement>();

let prefetchState: "idle" | "running" | "done" = "idle";

export function isPrefetching() {
  return prefetchState === "running";
}

export function lazyWithPrefetch<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
  options: LazyWithPrefetchOptions = {},
) {
  if (options.prefetchFirst) {
    prefetchQueue.unshift(load);
  } else {
    prefetchQueue.push(load);
  }
  return lazy(async () => {
    await retryFailedStylesheets();
    return load();
  });
}

export async function prefetchLazyComponents() {
  // anonymous share/docs viewers, OAuth consent and the PDF renderer only need the page they opened
  const isStandalonePage = /^\/(share|docs|pdf-render|oauth)(\/|$)/.test(
    window.location.pathname,
  );
  const saveData = (navigator as NavigatorWithConnection).connection?.saveData;
  if (
    prefetchState !== "idle" ||
    isStandalonePage ||
    saveData ||
    !navigator.onLine
  ) {
    return;
  }

  prefetchState = "running";
  document.addEventListener("error", collectFailedStylesheet, true);
  try {
    // the queue also receives components declared by chunks this loop loads, such as the editor's
    while (prefetchQueue.length > 0) {
      const load = prefetchQueue.shift();
      await load();
    }
  } catch {
    // stop at the first failure so a flaky network doesn't break more stylesheets; the rest load when rendered
  } finally {
    document.removeEventListener("error", collectFailedStylesheet, true);
    prefetchState = "done";
  }
}

function collectFailedStylesheet(event: Event) {
  const link = event.target;
  if (
    link instanceof HTMLLinkElement &&
    link.rel === "stylesheet" &&
    link.href.startsWith(`${window.location.origin}/`)
  ) {
    failedStylesheets.add(link);
  }
}

function retryFailedStylesheets() {
  const retries = [...failedStylesheets].map((failed) => {
    failedStylesheets.delete(failed);
    const retry = failed.cloneNode() as HTMLLinkElement;
    const settled = new Promise<void>((resolve) => {
      retry.addEventListener("load", () => resolve());
      retry.addEventListener("error", () => {
        failedStylesheets.add(retry);
        resolve();
      });
    });
    failed.remove();
    document.head.appendChild(retry);
    return settled;
  });
  return Promise.all(retries);
}
