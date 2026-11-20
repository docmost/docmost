// Includes both the legacy page.<pageId> cache and per-account draft caches.
const PAGE_DATABASE_PREFIX = "page.";
const FAILED_PREFIX = "unsaved-page-update:";
// A full or unavailable IndexedDB may recover on the next edit. Keep the Yjs
// update across navigation even if the browser also refuses localStorage.
const memory = new Map<string, string>();

function backupKeys() {
  const keys = new Set(memory.keys());
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(FAILED_PREFIX)) keys.add(key);
    }
  } catch {
    // Only the in-memory copy is available.
  }
  return keys;
}

function removeBackup(key: string) {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage is unavailable. */
  }
}

export const failedPageWrites = {
  keep(database: string, id: string, update: string) {
    const key = `${FAILED_PREFIX}${database}:${id}`;
    try {
      localStorage.setItem(key, update);
      memory.delete(key);
    } catch {
      memory.set(key, update);
    }
  },
  read(database: string) {
    const prefix = `${FAILED_PREFIX}${database}:`;
    const updates = new Map<string, string>();
    for (const key of backupKeys()) {
      if (!key.startsWith(prefix)) continue;
      let value = memory.get(key);
      if (!value) {
        try {
          value = localStorage.getItem(key);
        } catch {
          /* Storage is unavailable. */
        }
      }
      if (value) updates.set(key.slice(prefix.length), value);
    }
    return updates;
  },
  remove(database: string, id: string) {
    removeBackup(`${FAILED_PREFIX}${database}:${id}`);
  },
};

export async function deleteLocalPageData(): Promise<void> {
  for (const key of backupKeys()) removeBackup(key);
  try {
    const databases = (await indexedDB.databases?.()) ?? [];
    const pageDatabaseNames = databases
      .map((database) => database.name)
      .filter((name) => name?.startsWith(PAGE_DATABASE_PREFIX));

    await Promise.all(
      pageDatabaseNames.map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
    );
  } catch {
    // local cleanup must never block logout
  }
}
