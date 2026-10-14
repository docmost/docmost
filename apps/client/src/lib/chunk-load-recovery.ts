import { isPrefetching } from "@/lib/lazy-prefetch.ts";

const RELOAD_AT_KEY = "chunk-reload-at";
const RELOAD_COOLDOWN_MS = 60_000;
// how Chromium, Firefox and Safari word a module that failed to download, plus Vite's CSS preload failure
const LOAD_FAILURE_MESSAGES = [
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
  "Unable to preload CSS",
];

export function claimChunkReload(): boolean {
  if (!navigator.onLine) {
    return false;
  }

  try {
    const lastReloadAt = Number(sessionStorage.getItem(RELOAD_AT_KEY));
    if (Date.now() - lastReloadAt < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export function isChunkLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return LOAD_FAILURE_MESSAGES.some((text) => message.includes(text));
}

export function claimReloadForPreloadError(error: unknown): boolean {
  if (isPrefetching() || !isChunkLoadFailure(error)) {
    return false;
  }
  return claimChunkReload();
}

export function installChunkLoadRecovery() {
  // a tab opened before a deploy asks for chunks that no longer exist; a reload picks up the new build
  window.addEventListener("vite:preloadError", (event) => {
    if (claimReloadForPreloadError(event.payload)) {
      window.location.reload();
    }
  });
}
