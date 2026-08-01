import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { useDebouncedCallback } from "@mantine/hooks";
import {
  decryptBytes,
  encryptBytes,
  sectionAad,
} from "@/features/encryption/services/crypto";
import {
  decodeBlob,
  encodeYdocBlob,
} from "@/features/encryption/services/encrypted-blob";
import {
  getEncryptedBlob,
  updateEncryptedPage,
} from "@/features/encryption/services/encryption-service";
import {
  isRemoteOrigin,
  MERGE_ORIGIN,
} from "@/features/encryption/services/sync-origins";

/** awareness field marking a peer as able to write (see electSaver) */
export const CAN_EDIT_FIELD = "canEdit";

const TYPING_DEBOUNCE_MS = 800;
const REMOTE_FALLBACK_MS = 15_000;
const MAX_MERGE_ATTEMPTS = 5;
/** backoff for retrying a save that failed for a non-conflict reason */
const SAVE_RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 60_000];

/**
 * Whether this client is the one responsible for the durability fallback for
 * an edit authored by `authors`.
 *
 * Every peer sees every remote edit, so without an election each of them would
 * arm the fallback save and a burst of edits would produce one write per peer,
 * each racing the others into a 409, a refetch, a decrypt and a merge.
 *
 * The authors are excluded from the election, which is the whole point of the
 * fallback: the author already saves its own work ~800ms after typing, so the
 * peer standing by must be a *different* client — one that is still there if
 * the author's tab dies before that save lands. Electing the author would mean
 * nobody covers for it, and the edit would exist only in other peers' memory.
 *
 * Every peer computes this identically from the awareness state they share, so
 * exactly one of them arms.
 */
export function electSaver(
  awareness: Awareness,
  clientID: number,
  authors: ReadonlySet<number> = new Set(),
): boolean {
  if (authors.has(clientID)) return false;

  let lowest = clientID;
  awareness.getStates().forEach((state: any, id: number) => {
    if (state?.[CAN_EDIT_FIELD] && !authors.has(id) && id < lowest) {
      lowest = id;
    }
  });
  return lowest === clientID;
}

/**
 * The clients whose changes a transaction carries, from the clocks it moved.
 *
 * Read off the transaction rather than parsed from the update bytes because of
 * when it has to be available: Yjs emits `beforeObserverCalls` → type observers
 * → `afterTransaction` → `update`, and the type observers are what drive the
 * editor's onUpdate and therefore the election. Reading the update bytes would
 * mean answering one event too late.
 */
export function authorsOfTransaction(transaction: Y.Transaction): Set<number> {
  const authors = new Set<number>();
  transaction.afterState.forEach((clock, client) => {
    if (clock > (transaction.beforeState.get(client) ?? 0)) {
      authors.add(client);
    }
  });
  return authors;
}

export interface EncryptedPersistenceOptions {
  pageId: string;
  /** encryption root whose key opens this page; binds the blob to it */
  sectionId: string;
  dek: CryptoKey;
  ydoc: Y.Doc;
  awareness: Awareness;
  editable: boolean;
  initialVersion: number;
  /** the Y.Doc was seeded from a legacy v1 JSON blob before mount */
  needsMigration: boolean;
}

export interface EncryptedPersistence {
  /** fire-and-forget save; failures surface through saveError/conflict */
  persistQuiet: (opts?: { forSnapshot?: boolean }) => void;
  /**
   * Whether this client should be the one to write on the way out — true for
   * the author of unsaved work, and for the peer elected to cover for an
   * absent one. Every editable peer marks itself dirty on a remote edit so a
   * later election can pick the work up, so "dirty" alone would have all of
   * them save the same document at once.
   */
  shouldPersistOnLeave: () => boolean;
  /** save the document now, whether or not this client authored the change */
  flush: () => Promise<void>;
  /** record a local edit and schedule the debounced save */
  onLocalEdit: () => void;
  /** record a remote edit; only the elected saver arms the fallback save */
  onRemoteEdit: () => void;
  conflict: boolean;
  saveError: boolean;
  /** safe to sync with other clients (see the migration comment below) */
  migrated: boolean;
  editorRef: React.MutableRefObject<Editor | null>;
}

/**
 * The save half of the encrypted editor: encodes the Y.Doc, encrypts it and
 * writes it back, serializing concurrent calls and merging on version
 * conflicts. Split out from the editor component so the state machine can be
 * exercised without mounting ProseMirror.
 */
export function useEncryptedPersistence(
  opts: EncryptedPersistenceOptions,
): EncryptedPersistence {
  const {
    pageId,
    sectionId,
    dek,
    ydoc,
    awareness,
    editable,
    initialVersion,
    needsMigration,
  } = opts;

  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // Both track the window between seeding from a legacy v1 blob and the first
  // successful save. In that window the seed exists only locally, so syncing
  // with another client (which may hold an independent seed of the same
  // document) would duplicate the content: `migrated` gates relay sync, and
  // `unsyncedSeedRef` turns a 409 into a hard conflict instead of a merge.
  // Pages encrypted by this version are written as v2 and start migrated, so
  // this only ever gates blobs written before the v2 format existed.
  const [migrated, setMigrated] = useState(!needsMigration);
  const unsyncedSeedRef = useRef(needsMigration);
  const versionRef = useRef<number>(initialVersion);
  // When the next history snapshot becomes due, on this client's clock. The
  // server answers with a *relative* delay so clock skew between the two can
  // never make this ask on every save; the interval itself lives only on the
  // server (it can't dedup ciphertext by content, so the interval is the only
  // throttle). 0 means "ask on the first save".
  const nextSnapshotAtRef = useRef(0);
  // True when the content we last saved is newer than the newest history
  // snapshot. Plaintext pages get a trailing snapshot from a delayed queue
  // job; encrypted ones are only ever snapshotted by a client request, so
  // without this the work done after the last snapshot would never enter
  // history once the user stops typing.
  const unsnapshottedRef = useRef(false);
  const snapshotTimerRef = useRef<number | null>(null);
  const conflictRef = useRef(false);
  const dirtyRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  // Whether *this* client authored anything unsaved, as opposed to merely
  // holding remote work in memory. Every peer marks itself dirty on a remote
  // edit so that a later election can pick the work up, but only the client
  // whose user actually typed should warn them on close or race the others
  // into a save when the tab is hidden.
  const locallyEditedRef = useRef(false);
  // tail of the save queue; see persist()
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  // useEditor only reconfigures on pageId, so permission changes are read
  // from this ref inside the callbacks rather than from the closure
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const editorRef = useRef<Editor | null>(null);

  // memoised: persist() depends on it, and a fresh array every render would
  // rebuild persist, flush, and every effect keyed on them
  const aad = useMemo(() => sectionAad(sectionId), [sectionId]);

  /**
   * Re-save once the server's snapshot interval expires, so the content
   * written after the last snapshot still reaches history when the user
   * stops editing. Re-armed after every save; disarmed as soon as a save
   * comes back with snapshotSaved.
   */
  const persistRef =
    useRef<(opts?: { forSnapshot?: boolean }) => Promise<void>>(null);

  const scheduleTrailingSnapshot = useCallback(() => {
    if (snapshotTimerRef.current !== null) {
      window.clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    if (!unsnapshottedRef.current || !editableRef.current) {
      return;
    }
    // small margin so the request cannot land a few ms before it is due
    const delay = Math.max(0, nextSnapshotAtRef.current - Date.now()) + 1000;
    snapshotTimerRef.current = window.setTimeout(() => {
      snapshotTimerRef.current = null;
      persistRef.current?.({ forSnapshot: true }).catch(() => {});
    }, delay);
  }, []);

  /**
   * Save the current document. Calls are serialized: each one queues behind
   * the save already in flight, so an awaited persist() only settles once
   * *its own* write has been attempted, and rejects if that write was lost.
   * Callers that do not care (typing, fallbacks) go through persistQuiet.
   */
  const persist = useCallback(
    (options?: { forSnapshot?: boolean }): Promise<void> => {
      const ed = editorRef.current;
      // A trailing-snapshot save re-sends unchanged content on purpose: the
      // server only snapshots what a save request carries.
      const hasWork =
        dirtyRef.current || (options?.forSnapshot && unsnapshottedRef.current);
      // Never save unless the user can edit and actually changed the document —
      // this also protects against flushing a half-initialized editor state.
      // A destroyed editor is fine: the bytes come from the Y.Doc, and the
      // unmount flush is exactly the save that must not be dropped.
      if (!editableRef.current || !ed || !hasWork) {
        return Promise.resolve();
      }
      if (conflictRef.current) {
        return Promise.reject(new Error("page is in conflict"));
      }
      // Encode synchronously before queueing as an unmount fallback: the
      // flush-on-unmount save must capture the document while the parent
      // still owns a live Y.Doc, even when another save is in flight ahead.
      // Entries that run while the doc is still alive re-encode below so a
      // later queue entry picks up 409 merges from earlier ones.
      const fallbackBytes = encodeYdocBlob(ydoc);
      dirtyRef.current = false;
      // forSnapshot asks unconditionally — the server throttles if it is too
      // soon, and answers with a fresh delay either way
      const saveHistory =
        !!options?.forSnapshot || Date.now() >= nextSnapshotAtRef.current;

      const run = async () => {
        if (conflictRef.current) {
          throw new Error("page is in conflict");
        }
        // Prefer live state so a later queue entry includes merges from an
        // earlier 409 retry. Fall back to the pre-queue capture when the doc
        // was destroyed on unmount before this entry ran.
        let update = ydoc.isDestroyed ? fallbackBytes : encodeYdocBlob(ydoc);
        // bounded merge-and-retry: one round per competing writer, so a hot
        // page cannot spin here forever
        for (let attempt = 0; attempt < MAX_MERGE_ATTEMPTS; attempt++) {
          try {
            const encryptedBlob = await encryptBytes(dek, update, aad);
            const result = await updateEncryptedPage({
              pageId,
              encryptedBlob,
              baseVersion: versionRef.current,
              saveHistory,
            });
            if (typeof result.nextSnapshotInMs === "number") {
              nextSnapshotAtRef.current = Date.now() + result.nextSnapshotInMs;
            }
            // The content just saved is in history only if the server took a
            // snapshot of it; otherwise arm the trailing snapshot.
            unsnapshottedRef.current = !result.snapshotSaved;
            scheduleTrailingSnapshot();
            versionRef.current = result.version;
            unsyncedSeedRef.current = false;
            locallyEditedRef.current = false;
            setMigrated(true);
            setSaveError(false);
            clearRetry();
            return;
          } catch (err: any) {
            dirtyRef.current = true;
            if (err?.response?.status !== 409) {
              setSaveError(true);
              scheduleRetryRef.current();
              throw err;
            }
            // Another client saved first. The doc is a CRDT now: pull the
            // remote state into the local Y.Doc and retry with the merged doc.
            try {
              const remote = await getEncryptedBlob(pageId);
              if (remote.encryptedBlob) {
                const bytes = await decryptBytes(
                  dek,
                  remote.encryptedBlob,
                  aad,
                );
                const decoded = decodeBlob(bytes);
                if (decoded.kind !== "ydoc" || unsyncedSeedRef.current) {
                  // remote was written by a legacy v1 client, or both clients
                  // seeded independently from the same v1 blob — cannot merge
                  throw new Error("cannot merge remote blob");
                }
                // MERGE_ORIGIN: peers already have this state — the sync
                // layers must not rebroadcast it as a local edit
                Y.applyUpdate(ydoc, decoded.update, MERGE_ORIGIN);
              }
              versionRef.current = remote.version;
              // the merged doc supersedes what we tried to send
              update = encodeYdocBlob(ydoc);
              dirtyRef.current = false;
            } catch {
              conflictRef.current = true;
              setConflict(true);
              editorRef.current?.setEditable(false);
              throw err;
            }
          }
        }
        // The last merge cleared the dirty flag before retrying, and that
        // retry never happened. Leaving it clear would make the unmount flush
        // a no-op and lose a document that only exists in memory.
        dirtyRef.current = true;
        setSaveError(true);
        scheduleRetryRef.current();
        throw new Error("could not save page: too many conflicts");
      };

      const next = saveChainRef.current.then(run, run);
      // the chain itself must never reject, or one failure would poison every
      // save queued after it; each caller sees its own result through `next`
      saveChainRef.current = next.then(
        () => {},
        () => {},
      );
      return next;
    },
    [aad, dek, pageId, ydoc, scheduleTrailingSnapshot],
  );

  persistRef.current = persist;

  // fire-and-forget saves: failures already surface through the save-error
  // banner or the conflict state, so keep them out of unhandled rejections
  const persistQuiet = useCallback(
    (options?: { forSnapshot?: boolean }) => {
      void persist(options).catch(() => {});
    },
    [persist],
  );

  const debouncedPersist = useDebouncedCallback(
    () => persistQuiet(),
    TYPING_DEBOUNCE_MS,
  );
  // durability fallback for changes authored elsewhere: normally the author
  // saves within ~800ms, but if it crashed or went offline before flushing,
  // the elected peer persists the merged state instead of losing it on reload
  const remoteFallbackPersist = useDebouncedCallback(
    () => persistQuiet(),
    REMOTE_FALLBACK_MS,
  );
  // the editor captures its handlers once; always call through refs so we hit
  // the latest debounced wrappers / persist closure
  const debouncedPersistRef = useRef(debouncedPersist);
  debouncedPersistRef.current = debouncedPersist;
  const remoteFallbackPersistRef = useRef(remoteFallbackPersist);
  remoteFallbackPersistRef.current = remoteFallbackPersist;

  // Used by a history restore, which rewrites the Y.Doc directly: that reaches
  // the editor as a remote change, so nothing would mark the document dirty
  // and the restore could be lost on reload.
  const flush = useCallback(() => {
    dirtyRef.current = true;
    // a manual retry starts the ladder over and drops any pending attempt, so
    // the two cannot fire against each other
    clearRetry();
    return persist({ forSnapshot: true });
  }, [persist]);

  /**
   * Keep trying after a failed save.
   *
   * Without this a save that fails for any reason other than a version
   * conflict just sets the error banner and stops: nothing retries until the
   * user happens to type again, so a transient network failure could sit on
   * unsaved work indefinitely. Backs off so a server that is down is not
   * hammered, and gives up quietly once the banner has been up long enough
   * for the user to act on it.
   */
  /** drop any pending retry and start the backoff ladder over */
  const clearRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryAttemptRef.current = 0;
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current !== null) return;
    if (retryAttemptRef.current >= SAVE_RETRY_DELAYS_MS.length) return;

    const delay = SAVE_RETRY_DELAYS_MS[retryAttemptRef.current];
    retryAttemptRef.current += 1;
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      if (!dirtyRef.current || conflictRef.current || !editableRef.current) {
        return;
      }
      void persistRef.current?.().catch(() => {});
    }, delay);
  }, []);
  const scheduleRetryRef = useRef(scheduleRetry);
  scheduleRetryRef.current = scheduleRetry;
  const clearRetryRef = useRef(clearRetry);
  clearRetryRef.current = clearRetry;

  const shouldPersistOnLeave = useCallback(
    () =>
      dirtyRef.current &&
      editableRef.current &&
      (locallyEditedRef.current || electSaver(awareness, ydoc.clientID)),
    [awareness, ydoc],
  );
  const shouldPersistOnLeaveRef = useRef(shouldPersistOnLeave);
  shouldPersistOnLeaveRef.current = shouldPersistOnLeave;

  const onLocalEdit = useCallback(() => {
    dirtyRef.current = true;
    locallyEditedRef.current = true;
    // The user is still working, so the backoff ladder starts over rather than
    // staying exhausted from an earlier outage. The pending attempt is dropped
    // with it: the debounced save below covers this edit, and leaving both
    // armed would only queue a redundant write behind it.
    clearRetryRef.current();
    debouncedPersistRef.current();
  }, []);

  const onRemoteEdit = useCallback(() => {
    // Viewers receive CRDT updates but cannot persist; only editors act as
    // durability fallback if the author never flushed — and only the elected
    // one, so k editors do not produce k competing writes per burst.
    if (!editableRef.current) return;
    // remote content is in this document now whether or not we are the one who
    // will write it: staying dirty is what lets a later election, an unmount
    // flush, or a retry pick it up
    dirtyRef.current = true;
    if (!electSaver(awareness, ydoc.clientID, lastRemoteAuthorsRef.current)) {
      // not ours to save; make sure we are not still holding a timer from an
      // earlier edit whose election went the other way
      remoteFallbackPersistRef.current.cancel();
      return;
    }
    remoteFallbackPersistRef.current();
  }, [awareness, ydoc]);

  // Who authored the change currently being applied.
  //
  // Captured on `beforeObserverCalls`, which is the last event that precedes
  // the type observers — and the type observers are what y-prosemirror uses to
  // drive the editor's onUpdate, and therefore onRemoteEdit below. The `update`
  // event fires after all of that, so a listener there would always be reading
  // the *previous* edit's authors and the election would exclude the wrong
  // client (or, on the first remote edit of a session, nobody at all).
  const lastRemoteAuthorsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const onBeforeObserverCalls = (transaction: Y.Transaction) => {
      if (isRemoteOrigin(transaction.origin)) {
        lastRemoteAuthorsRef.current = authorsOfTransaction(transaction);
      }
    };
    ydoc.on("beforeObserverCalls", onBeforeObserverCalls);
    return () => ydoc.off("beforeObserverCalls", onBeforeObserverCalls);
  }, [ydoc]);

  /**
   * Re-run the election when the set of writers changes. If the client we were
   * relying on to save has just left — the author's tab closing is exactly the
   * case the fallback exists for — someone still here has to pick the work up.
   *
   * Deliberately keyed on *membership*, not on every awareness change: cursor
   * position and presence fields update constantly while people are typing, and
   * re-arming a debounced timer on each of those would push the fallback
   * further out for as long as anyone is active — the one situation where it
   * most needs to fire.
   */
  useEffect(() => {
    const writerSignature = () => {
      const writers: number[] = [];
      awareness.getStates().forEach((state: any, id: number) => {
        if (state?.[CAN_EDIT_FIELD]) writers.push(id);
      });
      return writers.sort((a, b) => a - b).join(",");
    };

    let lastWriters = writerSignature();

    const onAwarenessChange = () => {
      const writers = writerSignature();
      if (writers === lastWriters) return;
      lastWriters = writers;

      if (!editableRef.current || conflictRef.current) return;

      // no authors excluded: whoever wrote it is gone or idle by now
      if (electSaver(awareness, ydoc.clientID)) {
        if (dirtyRef.current) remoteFallbackPersistRef.current();
      } else {
        // someone else owns the fallback now; a timer left armed here would
        // fire anyway and produce exactly the competing writes and version
        // conflicts the election exists to prevent
        remoteFallbackPersistRef.current.cancel();
      }
    };
    awareness.on("change", onAwarenessChange);
    return () => awareness.off("change", onAwarenessChange);
  }, [awareness, ydoc]);

  // publish write capability so peers can run the same election
  useEffect(() => {
    awareness.setLocalStateField(CAN_EDIT_FIELD, editable);
  }, [awareness, editable]);

  // A legacy v1 blob seeded into the Y.Doc is rewritten in the current format
  // by the next save — so ask for one promptly (editors only; viewers 403).
  useEffect(() => {
    if (needsMigration && editableRef.current) {
      dirtyRef.current = true;
      debouncedPersist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Durability for a tab that is closed or backgrounded rather than navigated
   * away from.
   *
   * Unlike plaintext pages, whose content reaches the server through the
   * collaboration session, an encrypted page is only durable once this client
   * saves it — and the unmount flush only runs on in-app navigation. Hiding the
   * tab is the last moment the page is reliably still alive and able to run the
   * asynchronous encrypt a save needs, so pending work is flushed there.
   *
   * `beforeunload` cannot save (encryption is async and the page is being torn
   * down) but it can warn, which is the honest thing to do when the alternative
   * is silently dropping the last few seconds of typing.
   */
  useEffect(() => {
    const shouldFlush = shouldPersistOnLeaveRef.current;

    const flushIfHidden = () => {
      if (document.visibilityState === "hidden" && shouldFlush()) {
        persistRef.current?.({ forSnapshot: true }).catch(() => {});
      }
    };
    const onPageHide = () => {
      if (shouldFlush()) {
        persistRef.current?.({ forSnapshot: true }).catch(() => {});
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!locallyEditedRef.current || !editableRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("visibilitychange", flushIfHidden);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", flushIfHidden);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [awareness, ydoc]);

  // timers must not outlive the editor
  useEffect(() => {
    return () => {
      if (snapshotTimerRef.current !== null) {
        window.clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = null;
      }
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  return {
    persistQuiet,
    shouldPersistOnLeave,
    flush,
    onLocalEdit,
    onRemoteEdit,
    conflict,
    saveError,
    migrated,
    editorRef,
  };
}
