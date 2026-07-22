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
  editable: boolean;
}

export default function EncryptedPageEditor({
  pageId,
  pageTitle,
  encryptionMeta,
  editable,
}: EncryptedPageEditorProps) {
  const dek = usePageKey(pageId);
  const unlockPageKey = useUnlockPageKey();
  const [unlockOpened, setUnlockOpened] = useState(false);

  useAutoLock(pageId);

  // if a sibling tab already holds the DEK, unlock without re-prompting
  useEffect(() => {
    if (!dek) {
      requestPageKeyFromTabs(pageId);
    }
  }, [pageId, dek]);

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
            unlockPageKey(pageId, unlockedDek);
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
  const conflictRef = useRef(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const menuContainerRef = useRef(null);
  // useEditor only reconfigures on pageId, so permission changes are read
  // from this ref inside onUpdate / persist rather than from the closure
  const editableRef = useRef(editable);
  editableRef.current = editable;

  // editorRef + persist must be ready before useEditor: Collaboration's
  // y-binding can fire onUpdate synchronously during editor creation
  // (forceRerender), which would hit TDZ if these were declared below.
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const persist = useCallback(async () => {
    const ed = editorRef.current;
    // Never save unless the user can edit and actually changed the document —
    // this also protects against flushing a half-initialized editor state.
    if (
      !editableRef.current ||
      !ed ||
      ed.isDestroyed ||
      conflictRef.current ||
      !dirtyRef.current
    ) {
      return;
    }
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    try {
      // encode synchronously so the flush-on-unmount snapshot is taken
      // before the Y.Doc can be destroyed by the parent cleanup
      const bytes = encodeYdocBlob(ydoc);
      dirtyRef.current = false;
      const encryptedBlob = await encryptBytes(dek, bytes);

      const result = await updateEncryptedPage({
        pageId,
        encryptedBlob,
        baseVersion: versionRef.current,
      });
      versionRef.current = result.version;
      unsyncedSeedRef.current = false;
      setMigrated(true);
      setSaveError(false);
    } catch (err: any) {
      dirtyRef.current = true;
      if (err?.response?.status === 409) {
        // Another client saved first. The doc is a CRDT now: pull the remote
        // state into the local Y.Doc and retry the save with the merged doc.
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
          pendingRef.current = true;
        } catch {
          conflictRef.current = true;
          pendingRef.current = false;
          setConflict(true);
          editorRef.current?.setEditable(false);
        }
      } else {
        setSaveError(true);
      }
    } finally {
      savingRef.current = false;
      if (pendingRef.current && !conflictRef.current) {
        pendingRef.current = false;
        void persist();
      }
    }
  }, [dek, pageId, ydoc]);

  const debouncedPersist = useDebouncedCallback(() => void persist(), 800);
  // durability fallback for changes authored elsewhere: normally the author
  // saves within ~800ms, but if it crashed or went offline before flushing,
  // this peer persists the merged state instead of losing it on reload
  const remoteFallbackPersist = useDebouncedCallback(
    () => void persist(),
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

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(
      editable && !conflict && currentPageEditMode === PageEditMode.Edit,
    );
  }, [currentPageEditMode, editor, editable, conflict]);

  // flush pending changes when navigating away (no-op unless dirty)
  useEffect(() => {
    return () => {
      void persist();
    };
  }, [persist]);

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
