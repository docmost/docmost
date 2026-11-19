import { useEffect, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";

const LOCAL_OPEN_TIMEOUT = 2000;

type LoadedYdoc = { pageId: string; ydoc: Y.Doc };

// Load the IndexedDB copy before joining the room, so the first sync sends
// the server our state vector and only the missing updates come back.
export function usePageYdoc(pageId: string): Y.Doc | null {
  const [loaded, setLoaded] = useState<LoadedYdoc | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const local = new IndexeddbPersistence(`page.${pageId}`, ydoc);
    let active = true;
    const release = () => {
      if (!active) return;
      setLoaded((current) =>
        current?.ydoc === ydoc ? current : { pageId, ydoc },
      );
    };

    local.whenSynced.then(release);
    // IndexedDB can be blocked or never open; the room then syncs the whole document.
    local._db.catch(release);
    const timeout = setTimeout(() => {
      if (!local.db) release();
    }, LOCAL_OPEN_TIMEOUT);

    return () => {
      active = false;
      clearTimeout(timeout);
      local.destroy().catch(() => {});
    };
  }, [pageId]);

  return loaded?.pageId === pageId ? loaded.ydoc : null;
}
