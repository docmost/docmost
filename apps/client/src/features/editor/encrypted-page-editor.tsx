import "@/features/editor/styles/index.css";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { History } from "@tiptap/extension-history";
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
    content: any;
    version: number;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The decrypted content only ever lives in component state — it is never
  // written to the TanStack Query cache or any browser storage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const blob = await getEncryptedBlob(pageId);
        if (cancelled) return;
        if (!blob.encryptedBlob) {
          setLoaded({
            content: { type: "doc", content: [{ type: "paragraph" }] },
            version: blob.version,
          });
          return;
        }
        const bytes = await decryptBytes(dek, blob.encryptedBlob);
        if (cancelled) return;
        setLoaded({
          content: JSON.parse(new TextDecoder().decode(bytes)),
          version: blob.version,
        });
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

  if (!loaded) {
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
      initialContent={loaded.content}
      initialVersion={loaded.version}
    />
  );
}

interface DecryptedEditorProps {
  pageId: string;
  dek: CryptoKey;
  editable: boolean;
  initialContent: any;
  initialVersion: number;
}

function DecryptedEditor({
  pageId,
  dek,
  editable,
  initialContent,
  initialVersion,
}: DecryptedEditorProps) {
  const { t } = useTranslation();
  const [, setEditor] = useAtom(pageEditorAtom);
  const currentPageEditMode = useAtomValue(currentPageEditModeAtom);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const versionRef = useRef<number>(initialVersion);
  const conflictRef = useRef(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const menuContainerRef = useRef(null);

  const editor = useEditor(
    {
      extensions: [...mainExtensions, History],
      editable,
      content: initialContent,
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
      onUpdate() {
        dirtyRef.current = true;
        debouncedPersist();
      },
    },
    [pageId],
  );

  const editorRef = useRef(editor);
  editorRef.current = editor;

  const persist = useCallback(async () => {
    const ed = editorRef.current;
    // Never save unless the user actually changed the decrypted document —
    // this also protects against flushing a half-initialized editor state.
    if (!ed || ed.isDestroyed || conflictRef.current || !dirtyRef.current) {
      return;
    }
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    try {
      const json = ed.getJSON();
      dirtyRef.current = false;
      const bytes = new TextEncoder().encode(JSON.stringify(json));
      const encryptedBlob = await encryptBytes(dek, bytes);

      const result = await updateEncryptedPage({
        pageId,
        encryptedBlob,
        baseVersion: versionRef.current,
      });
      versionRef.current = result.version;
      setSaveError(false);
    } catch (err: any) {
      dirtyRef.current = true;
      if (err?.response?.status === 409) {
        conflictRef.current = true;
        pendingRef.current = false;
        setConflict(true);
        editorRef.current?.setEditable(false);
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
  }, [dek, pageId]);

  const debouncedPersist = useDebouncedCallback(() => void persist(), 800);

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
