import { ComponentType, lazy } from "react";

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

const routeLoaders: Array<() => Promise<unknown>> = [];

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

  for (const load of routeLoaders) {
    // a failed import also fires vite:preloadError, which owns recovery
    await load().catch(() => {});
  }
}
