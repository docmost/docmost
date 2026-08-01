import "@/features/editor/styles/index.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { ySyncPluginKey } from "y-prosemirror";
import { classifyUpdateOrigin } from "./classify-update";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { Alert, Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
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
import { createE2eeProvider } from "@/features/encryption/services/e2ee-provider";
import { useCollabToken } from "@/features/auth/queries/auth-query";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  randomElement,
  userColors,
} from "@/features/editor/extensions/utils.ts";
import { useEncryptedPersistence } from "@/features/editor/encrypted/use-encrypted-persistence";

// give up refreshing the collab token after this many consecutive rejections:
// a token the server keeps refusing will not start working on the next try,
// and each attempt costs a round of authorization queries
const MAX_TOKEN_REFRESH_ATTEMPTS = 3;
const TOKEN_REFRESH_BASE_MS = 1000;

export interface DecryptedEditorProps {
  pageId: string;
  sectionId: string;
  dek: CryptoKey;
  editable: boolean;
  ydoc: Y.Doc;
  awareness: Awareness;
  needsMigration: boolean;
  initialVersion: number;
}

/**
 * The editor for an encrypted page whose content is already decrypted into a
 * Y.Doc. Everything here works on plaintext; encryption happens on the way out
 * through useEncryptedPersistence (storage) and the e2ee provider (live sync).
 */
export default function DecryptedEditor({
  pageId,
  sectionId,
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
  const [syncUnavailable, setSyncUnavailable] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const tokenAttemptsRef = useRef(0);
  const tokenRetryTimerRef = useRef<number | null>(null);

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

  const {
    persistQuiet,
    shouldPersistOnLeave,
    flush,
    onLocalEdit,
    onRemoteEdit,
    conflict,
    saveError,
    migrated,
    editorRef,
  } = useEncryptedPersistence({
    pageId,
    sectionId,
    dek,
    ydoc,
    awareness,
    editable,
    initialVersion,
    needsMigration,
  });

  // handlers are captured once by useEditor ([pageId]); call through refs so
  // they always reach the current closures
  const onLocalEditRef = useRef(onLocalEdit);
  onLocalEditRef.current = onLocalEdit;
  const onRemoteEditRef = useRef(onRemoteEdit);
  onRemoteEditRef.current = onRemoteEdit;

  const editor = useEditor(
    {
      // Collaboration binds the editor to the local Y.Doc and provides
      // undo/redo (History must not be used alongside it). CollaborationCaret
      // renders peer cursors from the awareness carried by the e2ee relay.
      extensions: [
        ...mainExtensions,
        Collaboration.configure({ document: ydoc }),
        CollaborationCaret.configure({
          // the caret extension only reads `awareness` and the two listener
          // methods; our stand-in provides exactly those (see caretProvider)
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
        /*
         * Files are deliberately refused on encrypted pages.
         *
         * The plaintext editor uploads pasted and dropped files to the
         * attachment service, which stores them as-is — the encryption covers
         * page content only. Accepting them here would quietly publish the
         * contents of an image the user believes is inside an encrypted page,
         * so say no rather than leaking. Pasted text is unaffected.
         */
        handlePaste: (_view, event) => {
          if (event.clipboardData?.files?.length) {
            event.preventDefault();
            notifications.show({
              message: t("Files cannot be added to encrypted pages."),
              color: "orange",
            });
            return true;
          }
          return false;
        },
        handleDrop: (_view, event) => {
          if ((event as DragEvent).dataTransfer?.files?.length) {
            event.preventDefault();
            notifications.show({
              message: t("Files cannot be added to encrypted pages."),
              color: "orange",
            });
            return true;
          }
          return false;
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
          // @ts-ignore -- @tiptap/react's Editor is not assignable to the
          // @tiptap/core Editor the atom holds; same cast as page-editor.tsx
          setEditor(editor);
          editor.storage.pageId = pageId;
        }
      },
      onUpdate({ transaction }) {
        const origin = classifyUpdateOrigin(
          transaction.getMeta(ySyncPluginKey),
        );
        if (origin === 'remote') {
          onRemoteEditRef.current();
        } else if (origin === 'local') {
          onLocalEditRef.current();
        }
        // 'initial-render' is y-prosemirror hydrating the view, not an edit
      },
    },
    [pageId],
  );

  editorRef.current = editor;

  // live sync with other clients through the server's blind ciphertext relay.
  // Sibling tabs of this browser are peers like any other: they hold their own
  // key and their own connection, and never exchange plaintext directly.
  const collabToken = collabQuery?.token;
  useEffect(() => {
    // accessRevoked is terminal: without it here, any later change to the
    // effect's inputs (a refreshed collab token, for one) would open a fresh
    // socket against a decision the server has already made
    if (!migrated || !collabToken || syncUnavailable || accessRevoked) {
      return;
    }
    const provider = createE2eeProvider({
      pageId,
      sectionId,
      ydoc,
      dek,
      awareness,
      token: collabToken,
      // access to the page was taken away mid-session: there is no token to
      // refresh, so stop and say so rather than retrying a settled decision
      onAccessRevoked: () => setAccessRevoked(true),
      // an expired token closes the socket with 4401; a fresh token recreates
      // this provider through the effect deps. Bounded and backed off, so a
      // token the server keeps refusing cannot spin the authorization path.
      onUnauthorized: () => {
        tokenAttemptsRef.current += 1;
        if (tokenAttemptsRef.current > MAX_TOKEN_REFRESH_ATTEMPTS) {
          setSyncUnavailable(true);
          return;
        }
        const delay =
          TOKEN_REFRESH_BASE_MS * 2 ** (tokenAttemptsRef.current - 1);
        tokenRetryTimerRef.current = window.setTimeout(() => {
          tokenRetryTimerRef.current = null;
          void refetchCollabToken();
        }, delay);
      },
    });
    return () => provider.destroy();
  }, [
    pageId,
    sectionId,
    ydoc,
    dek,
    awareness,
    collabToken,
    migrated,
    syncUnavailable,
    accessRevoked,
    refetchCollabToken,
  ]);

  useEffect(() => {
    return () => {
      if (tokenRetryTimerRef.current !== null) {
        window.clearTimeout(tokenRetryTimerRef.current);
        tokenRetryTimerRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (editor && !editor.isDestroyed) {
      // @ts-ignore -- see onCreate above
      setEditor(editor);
      editor.storage.pageId = pageId;
    }
  }, [editor, pageId, setEditor]);

  // A history restore rewrites the bound Y.Doc directly, which onUpdate can
  // only see as a remote change — so it would be persisted by the durability
  // fallback alone, and a reload right after the success toast would bring
  // back the pre-restore ciphertext. Expose a flush handle so the restore can
  // make itself durable (and snapshotted) before reporting done.
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.storage.persistEncrypted = flush;
    return () => {
      delete editor.storage.persistEncrypted;
    };
  }, [editor, flush]);

  useEffect(() => {
    if (!editor) return;
    // accessRevoked included: once the server has said this user may no longer
    // edit, letting them keep typing only builds up work every save will
    // refuse. The banner explains it; this stops it happening.
    editor.setEditable(
      editable &&
        !conflict &&
        !accessRevoked &&
        currentPageEditMode === PageEditMode.Edit,
    );
  }, [currentPageEditMode, editor, editable, conflict, accessRevoked]);

  // Flush pending changes when navigating away. Asks for a snapshot too: this
  // is the last chance to get the closing state into history, and the server
  // ignores the request if one was taken recently. Gated the same way as the
  // tab-hide path — every editable peer is marked dirty by remote edits, so an
  // ungated flush would have all of them write the same document on leaving.
  useEffect(() => {
    return () => {
      if (shouldPersistOnLeave()) {
        persistQuiet({ forSnapshot: true });
      }
    };
  }, [persistQuiet, shouldPersistOnLeave]);

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
          <Group justify="space-between" align="center" wrap="nowrap">
            <Text size="sm">
              {t(
                "Your latest changes could not be saved. Check your connection.",
              )}
            </Text>
            {/* retrying happens automatically with backoff; this is for the
                user who does not want to wait for the next attempt */}
            <Button
              size="xs"
              variant="light"
              color="red"
              onClick={() => void flush().catch(() => {})}
            >
              {t("Retry")}
            </Button>
          </Group>
        </Alert>
      )}
      {accessRevoked && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={16} />}
          mb="md"
          title={t("Access to this page was removed")}
        >
          {t(
            "You can no longer edit this page. Reload to see your current access.",
          )}
        </Alert>
      )}
      {syncUnavailable && !conflict && !accessRevoked && (
        <Alert
          color="yellow"
          icon={<IconAlertTriangle size={16} />}
          mb="md"
          title={t("Live editing unavailable")}
        >
          {t(
            "Edits by other people will not appear until you reload. Your own changes are still saved.",
          )}
        </Alert>
      )}
      <div>
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
