import "@/features/editor/styles/index.css";
import { Alert } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCloudOff } from "@tabler/icons-react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import {
  WebSocketStatus,
  onStatelessParameters,
} from "@hocuspocus/provider";
import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
  useHocuspocusConnectionStatus,
  useHocuspocusEvent,
  useHocuspocusProvider,
  useHocuspocusSyncStatus,
} from "@hocuspocus/provider-react";
import {
  Editor,
  EditorContent,
  EditorProvider,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import {
  collabExtensions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { useAtom, useAtomValue } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  currentPageEditModeAtom,
  pageEditorAtom,
  yjsConnectionStatusAtom,
  yjsSyncedAtom,
  yjsUnsyncedAtom,
} from "@/features/editor/atoms/editor-atoms";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import {
  activeCommentIdAtom,
  showCommentPopupAtom,
  showReadOnlyCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import CommentDialog from "@/features/comment/components/comment-dialog";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import { ReadonlyBubbleMenu } from "@/features/editor/components/bubble-menu/readonly-bubble-menu";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import { TableHandlesLayer } from "@/features/editor/components/table/handle/table-handles-layer";
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import PdfMenu from "@/features/editor/components/pdf/pdf-menu.tsx";
import SubpagesMenu from "@/features/editor/components/subpages/subpages-menu.tsx";
import {
  handleFileDrop,
  handlePaste,
} from "@/features/editor/components/common/editor-paste-handler.tsx";
import ExcalidrawMenu from "./components/excalidraw/excalidraw-menu-lazy";
import DrawioMenu from "./components/drawio/drawio-menu";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import SearchAndReplaceDialog from "@/features/editor/components/search-and-replace/search-and-replace-dialog.tsx";
import { useDebouncedCallback, useDocumentVisibility } from "@mantine/hooks";
import { useIdle } from "@/hooks/use-idle.ts";
import { queryClient } from "@/main.tsx";
import { IPage } from "@/features/page/types/page.types.ts";
import { useParams } from "react-router-dom";
import { extractPageSlugId, platformModifierKey } from "@/lib";
import { FIVE_MINUTES } from "@/lib/constants.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { jwtDecode } from "jwt-decode";
import { searchSpotlight } from "@/features/search/constants.ts";
import { useEditorScroll } from "./hooks/use-editor-scroll";
import { EditorAiMenu } from "@/ee/ai/components/editor/ai-menu/ai-menu";
import { EditorLinkMenu } from "@/features/editor/components/link/link-menu";
import ColumnsMenu from "@/features/editor/components/columns/columns-menu.tsx";
import { TransclusionLookupProvider } from "@/features/editor/components/transclusion/transclusion-lookup-context";
import { useTranslation } from "react-i18next";
import {
  acquireCollabSocket,
  getCollabSocket,
  releaseCollabSocket,
} from "@/features/editor/collab-socket";

// How long to wait for the server before falling back to the local IndexedDB
// copy of the document instead of the stale REST snapshot.
const OFFLINE_FALLBACK_MS = 5000;

interface PageEditorProps {
  pageId: string;
  editable: boolean;
  content: any;
  canComment?: boolean;
}

export default function PageEditor({
  pageId,
  editable,
  content,
  canComment,
}: PageEditorProps) {
  const { t } = useTranslation();
  const { data: collabQuery, refetch: refetchCollabToken } = useCollabToken();
  const { pageSlug } = useParams();
  const slugId = extractPageSlugId(pageSlug);
  const [socket] = useState(getCollabSocket);
  const hasCollabToken = !!collabQuery?.token;

  useEffect(() => {
    if (!hasCollabToken) return;
    acquireCollabSocket();
    return () => releaseCollabSocket();
  }, [hasCollabToken]);

  const handleStateless = ({ payload }: onStatelessParameters) => {
    try {
      const message = JSON.parse(payload);

      if (message?.type === "page.saveFailed") {
        notifications.show({
          message: t(
            "Could not save this page. Your changes are still here — keep this tab open.",
          ),
          color: "red",
          autoClose: false,
        });
        return;
      }

      if (message?.type !== "page.updated" || !message.updatedAt) return;
      const pageData = queryClient.getQueryData<IPage>(["pages", slugId]);
      if (pageData) {
        queryClient.setQueryData(["pages", slugId], {
          ...pageData,
          updatedAt: message.updatedAt,
          ...(message.lastUpdatedBy && {
            lastUpdatedBy: message.lastUpdatedBy,
          }),
        });
      }
    } catch {
      // ignore unrelated stateless messages
    }
  };

  const handleAuthenticationFailed = () => {
    const payload = jwtDecode(collabQuery?.token);
    const now = Date.now().valueOf() / 1000;
    const isTokenExpired = now >= payload.exp;
    if (isTokenExpired) {
      refetchCollabToken();
    }
  };

  return (
    <TransclusionLookupProvider>
      {collabQuery?.token ? (
        <HocuspocusProviderWebsocketComponent websocketProvider={socket}>
          <HocuspocusRoom
            name={`page.${pageId}`}
            token={collabQuery.token}
            flushDelay={500}
            onStateless={handleStateless}
            onAuthenticationFailed={handleAuthenticationFailed}
          >
            <CollabPageEditor
              pageId={pageId}
              editable={editable}
              content={content}
              canComment={canComment}
            />
          </HocuspocusRoom>
        </HocuspocusProviderWebsocketComponent>
      ) : (
        <StaticPageEditor content={content} ariaLabel={t("Page content")} />
      )}
    </TransclusionLookupProvider>
  );
}

function CollabPageEditor({
  pageId,
  editable,
  content,
  canComment,
}: PageEditorProps) {
  const { t } = useTranslation();
  const provider = useHocuspocusProvider();
  const isComponentMounted = useRef(false);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    isComponentMounted.current = true;
  }, []);

  const [currentUser] = useAtom(currentUserAtom);
  const [, setEditor] = useAtom(pageEditorAtom);
  const [, setAsideState] = useAtom(asideStateAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const [showReadOnlyCommentPopup] = useAtom(showReadOnlyCommentPopupAtom);
  const [isLocalSynced, setIsLocalSynced] = useState(false);
  const [isRemoteSynced, setIsRemoteSynced] = useState(false);
  const [, setYjsConnectionStatus] = useAtom(yjsConnectionStatusAtom);
  const [, setYjsSynced] = useAtom(yjsSyncedAtom);
  const [, setYjsUnsynced] = useAtom(yjsUnsyncedAtom);
  const menuContainerRef = useRef(null);
  const { isIdle, resetIdle } = useIdle(FIVE_MINUTES, { initialState: false });
  const documentState = useDocumentVisibility();
  const { pageSlug, spaceSlug } = useParams();
  const slugId = extractPageSlugId(pageSlug);
  const currentPageEditMode = useAtomValue(currentPageEditModeAtom);
  const canScroll = useCallback(
    () => Boolean(isComponentMounted.current && editorRef.current),
    [isComponentMounted],
  );
  const { handleScrollTo } = useEditorScroll({ canScroll });

  useEffect(() => {
    const local = new IndexeddbPersistence(
      provider.configuration.name,
      provider.document,
    );
    local.on("synced", () => setIsLocalSynced(true));
    return () => {
      local.destroy();
    };
  }, [provider]);

  // Snapshot hooks, not events: this editor mounts over a shared singleton
  // socket, so an edge-triggered listener gets no value when the socket is
  // already connected.
  const connectionStatus = useHocuspocusConnectionStatus();
  const syncStatus = useHocuspocusSyncStatus();
  const isConnected = connectionStatus === WebSocketStatus.Connected;

  useHocuspocusEvent("synced", ({ state }) => setIsRemoteSynced(state));

  // The provider only ever emits `synced: true` — onClose resets the flag
  // silently. Without this, isRemoteSynced latches true for the session and
  // every "are we reconciled?" check below becomes a lie.
  useEffect(() => {
    if (!isConnected) setIsRemoteSynced(false);
  }, [isConnected]);

  useEffect(() => {
    setYjsConnectionStatus(connectionStatus);
  }, [connectionStatus, setYjsConnectionStatus]);

  useEffect(() => {
    setYjsUnsynced(syncStatus === "syncing");
  }, [syncStatus, setYjsUnsynced]);

  // Last line of defence: unacknowledged edits live only in this browser.
  useEffect(() => {
    if (syncStatus !== "syncing") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [syncStatus]);

  useEffect(() => {
    return () => setYjsUnsynced(false);
  }, [setYjsUnsynced]);

  // Only connect/disconnect on tab/idle, not destroy. Read the socket's real
  // status rather than the atom, which is a mirror and can lag a render.
  useEffect(() => {
    const socket = provider.configuration.websocketProvider;

    if (
      isIdle &&
      documentState === "hidden" &&
      socket.status === WebSocketStatus.Connected
    ) {
      socket.disconnect();
      return;
    }
    if (
      documentState === "visible" &&
      socket.status === WebSocketStatus.Disconnected
    ) {
      resetIdle();
      socket.connect();
    }
  }, [isIdle, documentState, provider, resetIdle]);

  const extensions = useMemo(() => {
    if (!currentUser?.user) {
      return mainExtensions;
    }

    return [...mainExtensions, ...collabExtensions(provider, currentUser.user)];
  }, [provider, currentUser?.user]);

  const editor = useEditor(
    {
      extensions,
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
              const slashCommand = document.querySelector("#slash-command");
              if (slashCommand) {
                return true;
              }
            }
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "Enter",
              ].includes(event.key)
            ) {
              const emojiCommand = document.querySelector("#emoji-command");
              if (emojiCommand) {
                return true;
              }
            }
          },
        },
        handlePaste: (_view, event) => {
          if (!editorRef.current) return false;

          return handlePaste(
            editorRef.current,
            event,
            pageId,
            currentUser?.user.id,
          );
        },
        handleDrop: (_view, event, _slice, moved) => {
          if (!editorRef.current) return false;

          return handleFileDrop(editorRef.current, event, moved, pageId);
        },
      },
      onCreate({ editor }) {
        if (editor) {
          // @ts-ignore
          setEditor(editor);
          // @ts-ignore
          editor.storage.pageId = pageId;
          // @ts-ignore
          editor.storage.spaceSlug = spaceSlug;
          handleScrollTo(editor);
          editorRef.current = editor;
        }
      },
      onUpdate({ editor }) {
        if (editor.isEmpty) return;
        const editorJson = editor.getJSON();
        //update local page cache to reduce flickers
        debouncedUpdateContent(editorJson);
      },
    },
    [pageId, editable, extensions],
  );

  useLayoutEffect(() => {
    if (editor && !editor.isDestroyed) {
      // @ts-ignore
      setEditor(editor);
      // @ts-ignore
      editor.storage.pageId = pageId;
      // @ts-ignore
      editor.storage.spaceSlug = spaceSlug;
      editorRef.current = editor;
    }
  }, [editor, pageId, spaceSlug, setEditor]);

  const editorIsEditable = useEditorState({
    editor,
    selector: (ctx) => {
      return ctx.editor?.isEditable ?? false;
    },
  });

  const debouncedUpdateContent = useDebouncedCallback((newContent: any) => {
    const pageData = queryClient.getQueryData<IPage>(["pages", slugId]);

    if (pageData) {
      queryClient.setQueryData(["pages", slugId], {
        ...pageData,
        content: newContent,
      });
    }
  }, 3000);

  const handleActiveCommentEvent = (event) => {
    const { commentId, resolved } = event.detail;

    if (resolved) {
      return;
    }

    setActiveCommentId(commentId);
    setAsideState({ tab: "comments", isAsideOpen: true });

    //wait if aside is closed
    setTimeout(() => {
      const selector = `div[data-comment-id="${commentId}"]`;
      const commentElement = document.querySelector(selector);
      commentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
  };

  useEffect(() => {
    document.addEventListener("ACTIVE_COMMENT_EVENT", handleActiveCommentEvent);
    return () => {
      document.removeEventListener(
        "ACTIVE_COMMENT_EVENT",
        handleActiveCommentEvent,
      );
    };
  }, []);

  useEffect(() => {
    setActiveCommentId(null);
    setShowCommentPopup(false);
    setAsideState({ tab: "", isAsideOpen: false });
  }, [pageId]);

  // Reconciled with the server at least once for THIS document. Editing before
  // that means typing into a Y.Doc that may not represent the server's state.
  const [hasRemoteSyncedOnce, setHasRemoteSyncedOnce] = useState(false);
  useEffect(() => {
    if (isRemoteSynced) setHasRemoteSyncedOnce(true);
  }, [isRemoteSynced]);

  // HocuspocusRoom swaps the provider when the document name changes but does
  // not remount its children, so every useState here survives navigation.
  // The reconciliation flags describe one specific room — carrying page A's
  // "synced" over to page B would mark the new document as reconciled before
  // it has talked to the server even once.
  //
  // showStatic and hasConnectedOnceRef are deliberately NOT reset: the live
  // editor is already on screen, and dropping back to the static one would
  // flicker on every navigation.
  useEffect(() => {
    setIsLocalSynced(false);
    setIsRemoteSynced(false);
    setHasRemoteSyncedOnce(false);
  }, [pageId]);

  const isSynced = isLocalSynced && isRemoteSynced;

  useEffect(() => {
    setYjsSynced(isSynced);
  }, [isSynced, setYjsSynced]);

  useEffect(() => {
    return () => setYjsSynced(false);
  }, [setYjsSynced]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(
      editable && currentPageEditMode === PageEditMode.Edit && hasRemoteSyncedOnce,
    );
  }, [currentPageEditMode, editor, editable, hasRemoteSyncedOnce]);

  const hasConnectedOnceRef = useRef(false);
  const [showStatic, setShowStatic] = useState(true);
  const [fallbackDeadlinePassed, setFallbackDeadlinePassed] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(
      () => setFallbackDeadlinePassed(true),
      OFFLINE_FALLBACK_MS,
    );
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (hasConnectedOnceRef.current) return;

    if (isConnected && isSynced) {
      hasConnectedOnceRef.current = true;
      setShowStatic(false);
      return;
    }

    // Fail open. StaticPageEditor renders the REST `content` prop, which is
    // whatever the server last persisted — with no connection that is stale,
    // and the user reads it as "my content disappeared".
    //
    // Either source having hydrated the Y.Doc means we hold something at least
    // as fresh, so show the live editor. Requiring a source (rather than the
    // timer alone) is what keeps us from flashing an empty document; accepting
    // either one is what keeps a blocked IndexedDB — private windows, storage
    // policies — from pinning the page read-only while the server is fine.
    if (fallbackDeadlinePassed && (isLocalSynced || isRemoteSynced)) {
      setShowStatic(false);
    }
  }, [
    isConnected,
    isSynced,
    isLocalSynced,
    isRemoteSynced,
    fallbackDeadlinePassed,
  ]);

  if (showStatic) {
    return <StaticPageEditor content={content} ariaLabel={t("Page content")} />;
  }

  return (
    <div className="editor-container" style={{ position: "relative" }}>
      {editable && !hasRemoteSyncedOnce && (
        <Alert
          variant="light"
          color="yellow"
          icon={<IconCloudOff size={18} />}
          mb="sm"
          role="status"
        >
          {t(
            "Offline — showing your last local copy. Editing is disabled until the connection is restored.",
          )}
        </Alert>
      )}
      <div ref={menuContainerRef}>
        <EditorContent editor={editor} />

        {editor && (
          <SearchAndReplaceDialog editor={editor} editable={editable} />
        )}

        {editor && editorIsEditable && (
          <div>
            <EditorAiMenu editor={editor} />
            <EditorLinkMenu editor={editor} />
            <EditorBubbleMenu editor={editor} />
            <TableMenu editor={editor} />
            <TableHandlesLayer editor={editor} />
            <ImageMenu editor={editor} />
            <VideoMenu editor={editor} />
            <PdfMenu editor={editor} />
            <CalloutMenu editor={editor} />
            <SubpagesMenu editor={editor} />
            <ExcalidrawMenu editor={editor} />
            <DrawioMenu editor={editor} />
            <ColumnsMenu editor={editor} />
          </div>
        )}
        {editor && !editorIsEditable && (editable || canComment) && (
          <ReadonlyBubbleMenu editor={editor} />
        )}
        {showCommentPopup && <CommentDialog editor={editor} pageId={pageId} />}
        {showReadOnlyCommentPopup && (
          <CommentDialog editor={editor} pageId={pageId} readOnly />
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

function StaticPageEditor({
  content,
  ariaLabel,
}: {
  content: any;
  ariaLabel: string;
}) {
  return (
    <EditorProvider
      editable={false}
      immediatelyRender={true}
      extensions={mainExtensions}
      content={content}
      editorProps={{
        attributes: {
          "aria-label": ariaLabel,
        },
      }}
    />
  );
}
