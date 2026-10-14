import { ComponentType, lazy } from "react";

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

const prefetchLoaders: Array<() => Promise<unknown>> = [];

let prefetching = false;

export function isPrefetching() {
  return prefetching;
}

export function lazyWithPrefetch<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
) {
  prefetchLoaders.push(load);
  return lazy(load);
}

export async function prefetchLazyComponents() {
  // anonymous share/docs viewers, OAuth consent and the PDF renderer only need the page they opened
  const isStandalonePage = /^\/(share|docs|pdf-render|oauth)(\/|$)/.test(
    window.location.pathname,
  );
  const saveData = (navigator as NavigatorWithConnection).connection?.saveData;
  if (isStandalonePage || saveData) {
    return;
  }

  prefetching = true;
  try {
    // for...of also visits loaders declared by chunks this loop loads, such as the editor's
    for (const load of prefetchLoaders) {
      // a failed prefetch is recovered when that component is actually rendered
      await load().catch(() => {});
    }
  } finally {
    prefetching = false;
  }
}
