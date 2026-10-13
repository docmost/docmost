import { ComponentType, lazy } from "react";

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

const routeLoaders: Array<() => Promise<unknown>> = [];

let prefetching = false;

export function isPrefetchingRoutes() {
  return prefetching;
}

export function lazyRoute<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
) {
  routeLoaders.push(load);
  return lazy(load);
}

export async function prefetchRoutes() {
  // anonymous share/docs viewers and the PDF renderer only need the page they opened
  const isStandalonePage = /^\/(share|docs|pdf-render)(\/|$)/.test(
    window.location.pathname,
  );
  const saveData = (navigator as NavigatorWithConnection).connection?.saveData;
  if (isStandalonePage || saveData) {
    return;
  }

  prefetching = true;
  try {
    for (const load of routeLoaders) {
      // a failed prefetch is recovered when that route is actually opened
      await load().catch(() => {});
    }
  } finally {
    prefetching = false;
  }
}
