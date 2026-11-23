import { useEffect, useMemo, useRef, useState } from "react";
import type { Doc } from "yjs";
import { PageDraftCache } from "./page-draft-cache";

const LOCAL_OPEN_TIMEOUT = 2000;
const LOCAL_RESTORE_TIMEOUT = 10_000;

type LoadedYdoc = {
  scope: { pageId: string; userId: string | undefined };
  ydoc: Doc;
  cache: PageDraftCache;
  hasCachedDocument: boolean;
  reopenConfirmed: () => void;
  discardRejectedChanges: (forgetPage?: boolean) => boolean;
};

export function usePageYdoc(
  pageId: string,
  userId: string | undefined,
  onStorageError: () => void,
  canReplayDrafts = true,
  verifiedReadOnly = false,
) {
  const scope = useMemo(() => ({ pageId, userId }), [pageId, userId]);
  const reportStorageError = useRef(onStorageError);
  reportStorageError.current = onStorageError;
  const replayAllowed = useRef(canReplayDrafts);
  replayAllowed.current = canReplayDrafts;
  const [loaded, setLoaded] = useState<LoadedYdoc | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let current: PageDraftCache | undefined;
    let timeout: ReturnType<typeof setTimeout>;
    const report = () => {
      if (active) reportStorageError.current();
    };
    const open = (serverOnly: boolean) => {
      let published = false;
      let discarded = false;
      let cache: PageDraftCache | undefined;
      const publish = (hasCachedDocument: boolean) => {
        if (!active || published || !cache || current !== cache) return;
        published = true;
        clearTimeout(timeout);
        setLoaded({
          scope,
          cache,
          hasCachedDocument,
          ydoc: cache.ydoc,
          reopenConfirmed: () => {
            if (!active || current !== cache || !cache?.hasPending) return;
            setLoaded(null);
            cache.close();
            open(false);
          },
          discardRejectedChanges: (forgetPage = false) => {
            if (!active || discarded || current !== cache) return false;
            discarded = true;
            setLoaded(null);
            // Hold the draft locks until the rollback transaction has committed,
            // even if the user navigates away in the meantime.
            current = undefined;
            void cache
              .discard(forgetPage)
              .catch(report)
              .finally(() => {
                cache?.close();
                if (active) open(true);
              });
            return true;
          },
        });
      };
      const useServer = () => {
        if (!active || published || current !== cache) return;
        cache?.close();
        current = cache = new PageDraftCache(
          pageId,
          userId,
          report,
          () => replayAllowed.current,
        );
        cache.useBackupStorage();
        publish(false);
        report();
      };
      try {
        current = cache = new PageDraftCache(
          pageId,
          userId,
          report,
          () => replayAllowed.current,
        );
        void cache.restore(serverOnly).then(publish, useServer);
        timeout = setTimeout(() => {
          if (cache?.opened)
            timeout = setTimeout(
              useServer,
              LOCAL_RESTORE_TIMEOUT - LOCAL_OPEN_TIMEOUT,
            );
          else useServer();
        }, LOCAL_OPEN_TIMEOUT);
      } catch {
        useServer();
      }
    };
    open(false);
    return () => {
      active = false;
      clearTimeout(timeout);
      current?.close();
    };
  }, [scope, pageId, userId]);

  const current = loaded?.scope === scope ? loaded : null;
  useEffect(() => {
    if (verifiedReadOnly) current?.reopenConfirmed();
    else if (canReplayDrafts)
      void current?.cache
        ?.resumeDrafts()
        .catch(() => reportStorageError.current());
  }, [current, canReplayDrafts, verifiedReadOnly]);
  return current;
}
