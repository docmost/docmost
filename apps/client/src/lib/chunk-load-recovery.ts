const RELOAD_AT_KEY = "chunk-reload-at";
const RELOAD_COOLDOWN_MS = 10_000;

export function claimChunkReload(): boolean {
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

export function installChunkLoadRecovery() {
  // a tab opened before a deploy asks for chunks that no longer exist; a reload picks up the new build
  window.addEventListener("vite:preloadError", () => {
    if (claimChunkReload()) {
      window.location.reload();
    }
  });
}
