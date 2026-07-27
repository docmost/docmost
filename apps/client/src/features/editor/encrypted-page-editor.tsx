import "@/features/editor/styles/index.css";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYDoc, ySyncPluginKey } from "y-prosemirror";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { Alert, Center, Loader } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useDebouncedCallback } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import {
  currentPageEditModeAtom,
  pageEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import { TableHandlesLayer } from "@/features/editor/components/table/handle/table-handles-layer";
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import PdfMenu from "@/features/editor/components/pdf/pdf-menu.tsx";
import ColumnsMenu from "@/features/editor/components/columns/columns-menu.tsx";
import { EditorLinkMenu } from "@/features/editor/components/link/link-menu";
import SearchAndReplaceDialog from "@/features/editor/components/search-and-replace/search-and-replace-dialog.tsx";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { platformModifierKey } from "@/lib";
import { searchSpotlight } from "@/features/search/constants.ts";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types";
import {
  requestPageKeyFromTabs,
  usePageKey,
  useUnlockPageKey,
} from "@/features/encryption/hooks/page-key-store";
import { useAutoLock } from "@/features/encryption/hooks/use-auto-lock";
import {
  getEncryptedBlob,
  updateEncryptedPage,
} from "@/features/encryption/services/encryption-service";
import {
  decryptBytes,
  encryptBytes,
} from "@/features/encryption/services/crypto";
import {
  decodeBlob,
  encodeYdocBlob,
} from "@/features/encryption/services/encrypted-blob";
import { createTabSync } from "@/features/encryption/services/tab-sync";
import { createE2eeProvider } from "@/features/encryption/services/e2ee-provider";
import { MERGE_ORIGIN } from "@/features/encryption/services/sync-origins";
import { useCollabToken } from "@/features/auth/queries/auth-query";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  randomElement,
  userColors,
} from "@/features/editor/extensions/utils.ts";
import { UnlockPageModal } from "@/features/encryption/components/unlock-page-modal";
import { LockedPageScreen } from "@/features/encryption/components/locked-page-screen";

interface EncryptedPageEditorProps {
  pageId: string;
  pageTitle?: string;
  encryptionMeta: EncryptionMeta;
  /** set when this page is keyed to an encrypted section's root */
  encryptionRootId?: string | null;
  editable: boolean;
}

export default function EncryptedPageEditor({
  pageId,
  pageTitle,
  encryptionMeta,
  encryptionRootId,
  editable,
}: EncryptedPageEditorProps) {
  const dek = usePageKey(pageId);
  const unlockPageKey = useUnlockPageKey();
  const [unlockOpened, setUnlockOpened] = useState(false);
  // the key belongs to the section, so store and fetch it under the section's
  // id rather than relying on the page→section index being populated first
  const sectionId = encryptionRootId ?? pageId;

  useAutoLock(pageId);

  // if a sibling tab already holds the DEK, unlock without re-prompting
  useEffect(() => {
    if (!dek) {
      requestPageKeyFromTabs(sectionId);
    }
  }, [sectionId, dek]);

  if (!dek) {
    return (
      <>
        <LockedPageScreen
          pageTitle={pageTitle}
          onUnlockClick={() => setUnlockOpened(true)}
        />
        <UnlockPageModal
          opened={unlockOpened}
          onClose={() => setUnlockOpened(false)}
          encryptionMeta={encryptionMeta}
          pageTitle={pageTitle}
          onUnlocked={(unlockedDek) => {
            unlockPageKey(sectionId, unlockedDek);
            setUnlockOpened(false);
          }}
        />
      </>
    );
  }

  return (
    <BlobLoader key={pageId} pageId={pageId} dek={dek} editable={editable} />
  );
}

/**
 * Fetches and decrypts the page blob. The Tiptap editor is only mounted
 * (in DecryptedEditor) once decryption succeeds, so no editor instance —
 * and no save path — can ever exist with placeholder/empty content.
 */
function BlobLoader({
  pageId,
  dek,
  editable,
}: {
  pageId: string;
  dek: CryptoKey;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<{
    ydoc: Y.Doc;
    // owned here together with the ydoc so both are destroyed only after
    // DecryptedEditor (and its relay provider) have fully cleaned up —
    // child effect cleanups always run before the parent's
    awareness: Awareness;
    // true when the blob was legacy v1 (ProseMirror JSON): the Y.Doc was
    // seeded from it and must be re-saved in the v2 ydoc format
    needsMigration: boolean;
    version: number;
    // identifies which key produced this state, so a key identity change
    // never leaves the editor mounted on a stale/destroyed doc
    dek: CryptoKey;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The decrypted content only ever lives in component state — it is never
  // written to the TanStack Query cache or any browser storage.
  useEffect(() => {
    let cancelled = false;
    let ydoc: Y.Doc | null = null;
    let awareness: Awareness | null = null;
    (async () => {
      try {
        const blob = await getEncryptedBlob(pageId);
        if (cancelled) return;
        ydoc = new Y.Doc();
        awareness = new Awareness(ydoc);
        if (!blob.encryptedBlob) {
          setLoaded({
            ydoc,
            awareness,
            needsMigration: false,
            version: blob.version,
            dek,
          });
          return;
        }
        const bytes = await decryptBytes(dek, blob.encryptedBlob);
        if (cancelled) return;
        const decoded = decodeBlob(bytes);
        if (decoded.kind === "ydoc") {
          Y.applyUpdate(ydoc, decoded.update);
          setLoaded({
            ydoc,
            awareness,
            needsMigration: false,
            version: blob.version,
            dek,
          });
        } else {
          // legacy v1 JSON blob: seed the Y.Doc BEFORE the editor mounts —
          // replacing a live collaborative doc via setContent crashes the
          // placeholder extension's position resolution
          const seededDoc = prosemirrorJSONToYDoc(
            getSchema(mainExtensions),
            decoded.content,
            "default",
          );
          Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(seededDoc));
          seededDoc.destroy();
          setLoaded({
            ydoc,
            awareness,
            needsMigration: true,
            version: blob.version,
            dek,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            t("Failed to decrypt page content. Please try unlocking again."),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      // Drop loaded so DecryptedEditor unmounts (provider.destroy runs in
      // its cleanup). Destroy the doc on the next task so React can finish
      // that unmount first — flushSync is illegal during lifecycle methods.
      setLoaded(null);
      const awarenessToDestroy = awareness;
      const ydocToDestroy = ydoc;
      setTimeout(() => {
        awarenessToDestroy?.destroy();
        ydocToDestroy?.destroy();
      }, 0);
    };
  }, [pageId, dek]);

  if (loadError) {
    return (
      <Alert
        color="red"
        icon={<IconAlertTriangle size={16} />}
        title={t("Decryption failed")}
      >
        {loadError}
      </Alert>
    );
  }

  // loaded.dek !== dek covers the render window after a key identity change
  // but before the load effect replaces the state — the old ydoc may already
  // be scheduled for destruction and must not stay mounted
  if (!loaded || loaded.dek !== dek) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <DecryptedEditor
      pageId={pageId}
      dek={dek}
      editable={editable}
      ydoc={loaded.ydoc}
      awareness={loaded.awareness}
      needsMigration={loaded.needsMigration}
      initialVersion={loaded.version}
    />
  );
}

interface DecryptedEditorProps {
  pageId: string;
  dek: CryptoKey;
  editable: boolean;
  ydoc: Y.Doc;
  awareness: Awareness;
  needsMigration: boolean;
  initialVersion: number;
}

function DecryptedEditor({
  pageId,
  dek,
  editable,
  ydoc,
  awareness,
  needsMigration,
  initialVersion,
}: DecryptedEditorProps) {
  const { t } = useTranslation();
  const [, setEditor] = useAtom(pageEditorAtom);
  const currentPageEditMode = useAtomValue(currentPageEditModeAtom);
  const currentUser = useAtomValue(currentUserAtom);
  const { data: collabQuery, refetch: refetchCollabToken } = useCollabToken();
  // UniqueID finds this provider on the caret extension and waits for
  // "synced" before filling in missing block ids; our doc is fully loaded
  // before the editor mounts, so report synced on the next tick
  const [caretProvider] = useState(() => ({
    awareness,
    on(event: string, callback: () => void) {
      if (event === "synced") {
        window.setTimeout(callback, 0);
      }
    },
    off() {},
  }));
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // Both track the window between seeding from a legacy v1 blob and the
  // first successful save. In that window the seed exists only locally, so
  // syncing or merging with another client (which may hold an independent
  // seed of the same document) would duplicate the content: `migrated`
  // gates tab/relay sync, `unsyncedSeedRef` turns a 409 into a hard
  // conflict instead of a merge.
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
  // tail of the save queue; see persist()
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const menuContainerRef = useRef(null);
  // useEditor only reconfigures on pageId, so permission changes are read
  // from this ref inside onUpdate / persist rather than from the closure
  const editableRef = useRef(editable);
  editableRef.current = editable;

  // editorRef + persist must be ready before useEditor: Collaboration's
  // y-binding can fire onUpdate synchronously during editor creation
  // (forceRerender), which would hit TDZ if these were declared below.
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  // persist is defined below but referenced by the trailing-snapshot timer
  const persistRef =
    useRef<(opts?: { forSnapshot?: boolean }) => Promise<void>>(null);

  /**
   * Re-save once the server's snapshot interval expires, so the content
   * written after the last snapshot still reaches history when the user
   * stops editing. Re-armed after every save; disarmed as soon as a save
   * comes back with snapshotSaved.
   */
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
    (opts?: { forSnapshot?: boolean }): Promise<void> => {
      const ed = editorRef.current;
      // A trailing-snapshot save re-sends unchanged content on purpose: the
      // server only snapshots what a save request carries.
      const hasWork =
        dirtyRef.current || (opts?.forSnapshot && unsnapshottedRef.current);
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
        !!opts?.forSnapshot || Date.now() >= nextSnapshotAtRef.current;

      const run = async () => {
        if (conflictRef.current) {
          throw new Error("page is in conflict");
        }
        // Prefer live state so a later queue entry includes merges from an
        // earlier 409 retry. Fall back to the pre-queue capture when the doc
        // was destroyed on unmount before this entry ran.
        let update = ydoc.isDestroyed
          ? fallbackBytes
          : encodeYdocBlob(ydoc);
        // bounded merge-and-retry: one round per competing writer, so a hot
        // page cannot spin here forever
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const encryptedBlob = await encryptBytes(dek, update);
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
            setMigrated(true);
            setSaveError(false);
            return;
          } catch (err: any) {
            dirtyRef.current = true;
            if (err?.response?.status !== 409) {
              setSaveError(true);
              throw err;
            }
            // Another client saved first. The doc is a CRDT now: pull the
            // remote state into the local Y.Doc and retry with the merged doc.
            try {
              const remote = await getEncryptedBlob(pageId);
              if (remote.encryptedBlob) {
                const decoded = decodeBlob(
                  await decryptBytes(dek, remote.encryptedBlob),
                );
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
        setSaveError(true);
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
    [dek, pageId, ydoc, scheduleTrailingSnapshot],
  );

  persistRef.current = persist;

  // fire-and-forget saves: failures already surface through the save-error
  // banner or the conflict state, so keep them out of unhandled rejections
  const persistQuiet = useCallback(
    (opts?: { forSnapshot?: boolean }) => {
      void persist(opts).catch(() => {});
    },
    [persist],
  );

  const debouncedPersist = useDebouncedCallback(() => persistQuiet(), 800);
  // durability fallback for changes authored elsewhere: normally the author
  // saves within ~800ms, but if it crashed or went offline before flushing,
  // this peer persists the merged state instead of losing it on reload
  const remoteFallbackPersist = useDebouncedCallback(
    () => persistQuiet(),
    15000,
  );
  // onUpdate is captured once by useEditor ([pageId]); always call through
  // refs so we hit the latest debounced wrappers / persist closure
  const debouncedPersistRef = useRef(debouncedPersist);
  debouncedPersistRef.current = debouncedPersist;
  const remoteFallbackPersistRef = useRef(remoteFallbackPersist);
  remoteFallbackPersistRef.current = remoteFallbackPersist;

  const editor = useEditor(
    {
      // Collaboration binds the editor to the local Y.Doc and provides
      // undo/redo (History must not be used alongside it). CollaborationCaret
      // renders peer cursors from the awareness carried by the e2ee relay.
      extensions: [
        ...mainExtensions,
        Collaboration.configure({ document: ydoc }),
        CollaborationCaret.configure({
          provider: caretProvider as any,
          user: {
            name: currentUser?.user?.name ?? "Anonymous",
            color: randomElement(userColors),
          },
        }),
      ],
      editable,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: {
        scrollThreshold: 80,
        scrollMargin: 80,
        attributes: {
          "aria-label": t("Page content"),
        },
        handleDOMEvents: {
          keydown: (_view, event) => {
            if (platformModifierKey(event) && event.code === "KeyS") {
              event.preventDefault();
              return true;
            }
            if (platformModifierKey(event) && event.code === "KeyK") {
              searchSpotlight.open();
              return true;
            }
            if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
              if (document.querySelector("#slash-command")) {
                return true;
              }
            }
          },
        },
      },
      onCreate({ editor }) {
        if (editor) {
          // @ts-ignore
          setEditor(editor);
          // @ts-ignore
          editor.storage.pageId = pageId;
        }
      },
      onUpdate({ transaction }) {
        // Undo/redo also carries ySync meta, so TipTap's isChangeOrigin()
        // would misclassify it as remote — inspect the meta directly.
        const syncMeta = transaction.getMeta(ySyncPluginKey);
        const isRemote =
          !!syncMeta?.isChangeOrigin && !syncMeta?.isUndoRedoOperation;
        if (isRemote) {
          // Viewers receive CRDT updates but cannot persist; only editors
          // act as durability fallback if the author never flushed.
          if (!editableRef.current) {
            return;
          }
          dirtyRef.current = true;
          // The author's client persists its own edits ~800ms after typing;
          // this slow fallback only lands if the author disappeared before
          // flushing, keeping remote edits durable at the cost of one
          // redundant save per burst.
          remoteFallbackPersistRef.current();
        } else {
          dirtyRef.current = true;
          debouncedPersistRef.current();
        }
      },
    },
    [pageId],
  );

  editorRef.current = editor;

  // live sync with other tabs of this browser editing the same page
  useEffect(() => {
    if (!migrated) {
      return;
    }
    return createTabSync(pageId, ydoc);
  }, [pageId, ydoc, migrated]);

  // live sync with other clients through the server's blind ciphertext relay
  const collabToken = collabQuery?.token;
  useEffect(() => {
    if (!migrated || !collabToken) {
      return;
    }
    const provider = createE2eeProvider({
      pageId,
      ydoc,
      dek,
      awareness,
      token: collabToken,
      // an expired token closes the socket with 4401; refetching yields a
      // fresh token, which recreates this provider via the effect deps
      onUnauthorized: () => void refetchCollabToken(),
    });
    return () => provider.destroy();
  }, [pageId, ydoc, dek, awareness, collabToken, migrated, refetchCollabToken]);

  // legacy v1 blob was seeded into the Y.Doc before mount: persist promptly
  // so the page migrates to the v2 ydoc format (editors only — viewers 403)
  useEffect(() => {
    if (needsMigration && editableRef.current) {
      dirtyRef.current = true;
      debouncedPersist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (editor && !editor.isDestroyed) {
      // @ts-ignore
      setEditor(editor);
      // @ts-ignore
      editor.storage.pageId = pageId;
    }
  }, [editor, pageId, setEditor]);

  // A history restore rewrites the bound Y.Doc directly, which onUpdate can
  // only see as a remote change — so it would be persisted by the 15s
  // durability fallback alone, and a reload right after the success toast
  // would bring back the pre-restore ciphertext. Expose a flush handle so the
  // restore can make itself durable (and snapshotted) before reporting done.
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // @ts-ignore
    editor.storage.persistEncrypted = () => {
      dirtyRef.current = true;
      return persist({ forSnapshot: true });
    };
    return () => {
      // @ts-ignore
      delete editor.storage.persistEncrypted;
    };
  }, [editor, persist]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(
      editable && !conflict && currentPageEditMode === PageEditMode.Edit,
    );
  }, [currentPageEditMode, editor, editable, conflict]);

  // flush pending changes when navigating away (no-op unless dirty). Asks for
  // a snapshot too: this is the last chance to get the closing state into
  // history, and the server ignores the request if one was taken recently.
  useEffect(() => {
    return () => {
      persistQuiet({ forSnapshot: true });
    };
  }, [persistQuiet]);

  // the trailing-snapshot timer must not outlive the editor
  useEffect(() => {
    return () => {
      if (snapshotTimerRef.current !== null) {
        window.clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="editor-container" style={{ position: "relative" }}>
      {conflict && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={16} />}
          mb="md"
          title={t("Editing conflict")}
        >
          {t(
            "This page was modified by someone else. Reload the page to get the latest version. Your unsaved changes were not stored.",
          )}
        </Alert>
      )}
      {saveError && !conflict && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={16} />}
          mb="md"
          title={t("Save failed")}
        >
          {t("Your latest changes could not be saved. Check your connection.")}
        </Alert>
      )}
      <div ref={menuContainerRef}>
        <EditorContent editor={editor} />

        {editor && (
          <SearchAndReplaceDialog editor={editor} editable={editable} />
        )}

        {editor && editor.isEditable && (
          <div>
            <EditorLinkMenu editor={editor} />
            <EditorBubbleMenu editor={editor} />
            <TableMenu editor={editor} />
            <TableHandlesLayer editor={editor} />
            <ImageMenu editor={editor} />
            <VideoMenu editor={editor} />
            <PdfMenu editor={editor} />
            <CalloutMenu editor={editor} />
            <ColumnsMenu editor={editor} />
          </div>
        )}
      </div>
      <div
        onClick={() => {
          if (editor && !editor.isDestroyed) editor.commands.focus("end");
        }}
        style={{ paddingBottom: "20vh" }}
      ></div>
    </div>
  );
}
