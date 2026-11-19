import { useEffect, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import { EDITOR_SCHEMA_VERSION } from "@docmost/editor-ext";
import * as Y from "yjs";

const LOCAL_OPEN_TIMEOUT = 2000;

type LoadedYdoc = { pageId: string; ydoc: Y.Doc };

// Import pending offline edits without ever exposing newer nodes to a stale
// tab through its IndexedDB. Opening a missing database is aborted immediately.
function readLegacyUpdates(name: string): Promise<Uint8Array[]> {
  if (typeof indexedDB === "undefined") return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name);
    open.onupgradeneeded = () => open.transaction.abort();
    open.onerror = () =>
      open.error?.name === "AbortError" ? resolve([]) : reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("updates")) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction("updates", "readonly");
      const read = tx.objectStore("updates").getAll();
      tx.oncomplete = () => {
        db.close();
        resolve(read.result);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

// Load the IndexedDB copy before joining the room, so the first sync sends
// the server our state vector and only the missing updates come back.
export function usePageYdoc(pageId: string): Y.Doc | null {
  const [loaded, setLoaded] = useState<LoadedYdoc | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const legacyName = `page.${pageId}`;
    const local = new IndexeddbPersistence(
      `${legacyName}.v${EDITOR_SCHEMA_VERSION}`,
      ydoc,
    );
    let active = true;
    const release = () => {
      if (!active) return;
      setLoaded((current) =>
        current?.ydoc === ydoc ? current : { pageId, ydoc },
      );
    };

    const legacyLoaded = readLegacyUpdates(legacyName)
      .then((updates) => {
        if (active && updates.length)
          ydoc.transact(() => {
            for (const update of updates) Y.applyUpdate(ydoc, update);
          });
      })
      .catch(() => {});
    Promise.all([local.whenSynced, legacyLoaded]).then(release);
    // IndexedDB can be blocked or never open; the room then syncs the whole document.
    local._db.catch(release);
    const timeout = setTimeout(() => {
      if (!local.db || local.synced) release();
      else local.whenSynced.then(release);
    }, LOCAL_OPEN_TIMEOUT);

    return () => {
      active = false;
      clearTimeout(timeout);
      local.destroy().catch(() => {});
    };
  }, [pageId]);

  return loaded?.pageId === pageId ? loaded.ydoc : null;
}
