import "@/features/editor/styles/index.css";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MessageType,
  WebSocketStatus,
  onStatelessParameters,
} from "@hocuspocus/provider";
import type { Doc as YDoc } from "yjs";
import type { PageDraftCache } from "./hooks/page-draft-cache";
import { notifications } from "@mantine/notifications";
import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
  useHocuspocusEvent,
  useHocuspocusProvider,
} from "@hocuspocus/provider-react";
import {
  Editor,
  EditorContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { createDocument } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  collabExtensions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { useAtom, useSetAtom } from "jotai";
import useCurrentUser from "@/features/user/hooks/use-current-user";
import {
  lightboxRequestAtom,
  pageEditorBindingAtom,
  yjsConnectionStatusAtom,
  yjsSyncedAtom,
} from "@/features/editor/atoms/editor-atoms";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import {
  activeCommentIdAtom,
  commentPanelTabAtom,
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
import LightboxView, {
  getLightboxClickRequest,
} from "@/features/editor/components/common/lightbox-view";
import {
  handleFileDrop,
  handlePaste,
} from "@/features/editor/components/common/editor-paste-handler.tsx";
import ExcalidrawMenu from "./components/excalidraw/excalidraw-menu-lazy";
import DrawioMenu from "./components/drawio/drawio-menu";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import SearchAndReplaceDialog from "@/features/editor/components/search-and-replace/search-and-replace-dialog.tsx";
import SearchNavigationDialog from "@/features/editor/components/search-and-replace/search-navigation-dialog.tsx";
import { useSearchNavigationParams } from "@/features/editor/components/search-and-replace/use-search-navigation-params.ts";
import { useDebouncedCallback, useDocumentVisibility } from "@mantine/hooks";
import { useIdle } from "@/hooks/use-idle.ts";
import { queryClient } from "@/main.tsx";
import { IPage } from "@/features/page/types/page.types.ts";
import { useParams, useSearchParams } from "react-router-dom";
import { extractPageSlugId, platformModifierKey } from "@/lib";
import { FIVE_MINUTES } from "@/lib/constants.ts";
import { PageEditMode, type IUser } from "@/features/user/types/user.types.ts";
import { jwtDecode } from "jwt-decode";
import { searchSpotlight } from "@/features/search/constants.ts";
import { useEditorScroll } from "./hooks/use-editor-scroll";
import { usePageYdoc } from "./hooks/use-page-ydoc";
import { useDestroyEditorBeforeChildren } from "./hooks/use-destroy-editor-before-children";
import { EditorAiMenu } from "@/ee/ai/components/editor/ai-menu/ai-menu";
import { usePageEditMode, usePageSyncPermission } from "@/ee/page-verification/hooks/use-page-edit-mode";
import { unlockedVerifiedPageIdAtom } from "@/ee/page-verification/atoms/page-edit-lock-atom";
import { EditorLinkMenu } from "@/features/editor/components/link/link-menu";
import ColumnsMenu from "@/features/editor/components/columns/columns-menu.tsx";
import { IntegrationPasteMenu } from "@/features/editor/components/integration-link/integration-paste-menu.tsx";
import { LinkPasteMenu } from "@/features/editor/components/link-preview/link-paste-menu.tsx";
import { BasePasteMenu } from "@/features/editor/components/base-embed/base-paste-menu.tsx";
import MicrosoftFileMenu from "@/features/editor/components/microsoft/microsoft-file-menu.tsx";
import MicrosoftFolderMenu from "@/features/editor/components/microsoft/microsoft-folder-menu.tsx";
import { MicrosoftFullscreenModal } from "@/features/editor/components/microsoft/microsoft-fullscreen-modal.tsx";
import { getInstalledIntegrations } from "@/features/integration/services/integration-service";
import { TransclusionLookupProvider } from "@/features/editor/components/transclusion/transclusion-lookup-context";
import { syncEditable } from "@/features/editor/page-editor.utils";
import { useTranslation } from "react-i18next";
import {
  acquireCollabSocket,
  getCollabSocket,
  releaseCollabSocket,
} from "@/features/editor/collab-socket";

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
  const { data: session } = useCurrentUser();
  const user = session?.user;
  const { data: collabQuery, refetch: refetchCollabToken } = useCollabToken(user);
  const { pageSlug } = useParams();
  const slugId = extractPageSlugId(pageSlug);
  const [socket] = useState(getCollabSocket);
  const hasCollabToken = !!collabQuery?.token;
  const [syncedDocument, setSyncedDocument] = useState<YDoc | null>(null);
  const [roomDeniedWrite, setRoomDeniedWrite] = useState(false);
  const handledWriteRefusal = useRef(false);
  const reconnecting = useRef(false);
  const setUnlockedPage = useSetAtom(unlockedVerifiedPageIdAtom);
  const onStorageError = useCallback(() => {
    notifications.show({
      id: "page-local-save-error",
      color: "yellow",
      autoClose: false,
      message: t(
        "Local saving is unavailable. Keep this tab open until your changes sync.",
      ),
    });
  }, [t]);
  const { editMode, isCheckingLock, isLocked } = usePageEditMode(pageId);
  const verifiedReadOnly = isLocked && editMode === PageEditMode.Read;
  const canReplayDrafts = editable && !roomDeniedWrite && !isCheckingLock && editMode === PageEditMode.Edit;
  const localDoc = usePageYdoc(pageId, user?.id, onStorageError, canReplayDrafts, verifiedReadOnly);
  const canMountEditor = Boolean(hasCollabToken && user && localDoc);
  const showStatic =
    !canMountEditor ||
    !(localDoc.hasCachedDocument || syncedDocument === localDoc.ydoc);

  useEffect(() => {
    if (!hasCollabToken) return;
    acquireCollabSocket();
    return () => releaseCollabSocket();
  }, [hasCollabToken]);

  const restrictPage = (access: "read" | "none") => {
    setRoomDeniedWrite(true);
    // A refetch can still read old permissions from the server cache.
    for (const key of [slugId, pageId]) {
      queryClient.setQueryData<IPage>(["pages", key], (page) =>
        page?.permissions?.canEdit
          ? { ...page, permissions: { ...page.permissions, canEdit: false } }
          : page,
      );
      if (access !== "none") continue;
      queryClient.getQueryCache()
        .find({ queryKey: ["pages", key], exact: true })
        ?.setState({
          status: "error",
          fetchStatus: "idle",
          data: undefined,
          error: Object.assign(new Error("Forbidden"), { status: 403 }),
        });
    }
    if (access === "none") localDoc?.discardRejectedChanges(true);
  };

  const handleStateless = ({ payload }: onStatelessParameters) => {
    try {
      const message = JSON.parse(payload);
      if (message?.type === "page.permissions") {
        restrictPage(message.access);
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
    } else {
      setRoomDeniedWrite(true);
      void queryClient.invalidateQueries({ queryKey: ["pages", slugId], exact: true }).then(() => {
        const error = queryClient.getQueryState<IPage, { status?: number }>(["pages", slugId])?.error;
        if (error?.status === 403 || error?.status === 404) localDoc?.discardRejectedChanges(true);
      });
    }
  };

  return (
    <TransclusionLookupProvider>
      {showStatic && (
        <StaticPageEditor content={content} ariaLabel={t("Page content")} />
      )}
      {canMountEditor && (
        <HocuspocusProviderWebsocketComponent websocketProvider={socket}>
          <HocuspocusRoom
            name={`page.${pageId}`}
            document={localDoc.ydoc}
            token={collabQuery.token}
            flushDelay={500}
            onOpen={() => {
              if (!reconnecting.current) return;
              reconnecting.current = false;
              setUnlockedPage((current) => current === pageId ? null : current);
              void queryClient.invalidateQueries({ queryKey: ["entitlements"], exact: true });
              void queryClient.invalidateQueries({ queryKey: ["page-verification-info", pageId], exact: true });
            }}
            onStateless={handleStateless}
            onAuthenticationFailed={handleAuthenticationFailed}
            onAuthenticated={({ scope }) => {
              void localDoc.cache
                ?.authenticated(scope === "read-write")
                .catch(onStorageError);
              if (scope === "readonly") {
                restrictPage("read");
              } else {
                handledWriteRefusal.current = false;
                if (roomDeniedWrite) void queryClient.invalidateQueries({ queryKey: ["pages", slugId], exact: true });
                setRoomDeniedWrite(false);
              }
            }}
            onSynced={({ state }) => {
              if (state && syncedDocument !== localDoc.ydoc) {
                localDoc.cache?.markSynced();
                setSyncedDocument(localDoc.ydoc);
              }
            }}
            onDisconnect={() => {
              reconnecting.current = true;
              localDoc.cache?.disconnected();
            }}
            onMessage={({ message }) => {
              // Hocuspocus sends SyncStatus(0) when it rejects a Yjs update.
              // The event has its own decoder, separate from the provider's.
              message.readVarString();
              const type = message.readVarUint();
              if (type !== MessageType.SyncStatus || message.readVarUint() !== 0) {
                localDoc.cache?.incoming(message, type);
                return;
              }
              // Both the handshake and a buffered update can be refused. One
              // server-only rejoin recovers the page until write access returns.
              if (handledWriteRefusal.current) return;
              if (!localDoc.discardRejectedChanges()) return;
              handledWriteRefusal.current = true;
              restrictPage("read");
            }}
          >
            <CollabPageEditor
              pageId={pageId}
              user={user}
              editable={editable && !roomDeniedWrite}
              canComment={canComment}
              requiresConnection={!localDoc.cache?.opened}
              cache={localDoc.cache}
              showStatic={showStatic}
            />
          </HocuspocusRoom>
        </HocuspocusProviderWebsocketComponent>
      )}
    </TransclusionLookupProvider>
  );
}

type CollabPageEditorProps = Omit<PageEditorProps, "content"> & {
  user: IUser;
  showStatic: boolean;
  requiresConnection: boolean;
  cache?: PageDraftCache;
};

function CollabPageEditor({
  pageId,
  editable,
  canComment,
  user,
  showStatic,
  requiresConnection,
  cache,
}: CollabPageEditorProps) {
  const { t } = useTranslation();
  const provider = useHocuspocusProvider();
  const editorRef = useRef<Editor | null>(null);

  const setPageEditor = useSetAtom(pageEditorBindingAtom);
  const [, setAsideState] = useAtom(asideStateAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const setCommentPanelTab = useSetAtom(commentPanelTabAtom);
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const [showReadOnlyCommentPopup] = useAtom(showReadOnlyCommentPopupAtom);
  const [lightboxRequest, setLightboxRequest] = useAtom(lightboxRequestAtom);
  const [isRemoteSynced, setIsRemoteSynced] = useState(false);
  const [yjsConnectionStatus, setYjsConnectionStatus] = useAtom(
    yjsConnectionStatusAtom,
  );
  const [, setYjsSynced] = useAtom(yjsSyncedAtom);
  const menuContainerRef = useRef(null);
  const { isIdle, resetIdle } = useIdle(FIVE_MINUTES, { initialState: false });
  const documentState = useDocumentVisibility();
  const { pageSlug } = useParams();
  const [searchParams] = useSearchParams();
  const slugId = extractPageSlugId(pageSlug);
  const { editMode, isCheckingLock, retryingVerification } = usePageEditMode(pageId);
  const canPublish = usePageSyncPermission(pageId);
  useLayoutEffect(() => getCollabSocket().bindRoom(provider, canPublish, cache), [pageId, provider, cache]);
  // Edits held back during a lock check go out as soon as it settles.
  useEffect(() => {
    getCollabSocket().resume(provider);
  }, [provider, isCheckingLock, retryingVerification, editMode, isRemoteSynced]);
  const canType =
    !showStatic && editable && editMode === PageEditMode.Edit &&
    !isCheckingLock && (!requiresConnection || isRemoteSynced);

  useHocuspocusEvent("synced", ({ state }) => setIsRemoteSynced(state));
  useHocuspocusEvent("status", ({ status }) => {
    setYjsConnectionStatus(status);
    if (status === WebSocketStatus.Disconnected) setIsRemoteSynced(false);
  });

  // Only connect/disconnect on tab/idle, not destroy
  useEffect(() => {
    const socket = provider.configuration.websocketProvider;

    if (
      isIdle &&
      documentState === "hidden" &&
      yjsConnectionStatus === WebSocketStatus.Connected
    ) {
      socket.disconnect();
      return;
    }
    if (
      documentState === "visible" &&
      yjsConnectionStatus === WebSocketStatus.Disconnected
    ) {
      resetIdle();
      socket.connect();
    }
  }, [isIdle, documentState, provider, resetIdle]);

  const extensions = useMemo(
    () => [...mainExtensions, ...collabExtensions(provider, user)],
    [provider, user],
  );

  const debouncedUpdateContent = useDebouncedCallback((doc: ProseMirrorNode) => {
    const pageData = queryClient.getQueryData<IPage>(["pages", slugId]);

    if (pageData) {
      queryClient.setQueryData(["pages", slugId], {
        ...pageData,
        // serialized once typing pauses: on a long page this is too slow for every keystroke
        content: doc.toJSON(),
      });
    }
  }, 3000);

  const editor = useEditor(
    {
      extensions,
      editable: canType,
      textDirection: "auto",
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      // nothing listens for the delete event, and tiptap maps every changed range on each update to emit it
      enableCoreExtensions: { delete: false },
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
            { pageId },
            user.id,
          );
        },
        handleDrop: (_view, event, _slice, moved) => {
          if (!editorRef.current) return false;

          return handleFileDrop(editorRef.current, event, moved, { pageId });
        },
        handleClickOn: (view, _pos, node) => {
          if (view.editable) return false;

          const request = getLightboxClickRequest(node);
          if (!request) return false;

          setLightboxRequest(request);
          return true;
        },
        handleDoubleClickOn: (_view, _pos, node) => {
          const request = getLightboxClickRequest(node);
          if (!request) return false;

          setLightboxRequest(request);
          return true;
        },
      },
      onCreate({ editor }) {
        if (editor) {
          // @ts-ignore
          editor.storage.pageId = pageId;
          editorRef.current = editor;
        }
      },
      onUpdate({ editor }) {
        if (editor.isEmpty || !provider.isAuthenticated) return;
        //update local page cache to reduce flickers
        debouncedUpdateContent(editor.state.doc);
      },
    },
    [pageId, extensions],
  );
  useEditorScroll(editor, !showStatic);

  useEffect(() => {
    // Read by the paste handler with no observer, so it must not be garbage collected.
    queryClient.prefetchQuery({
      queryKey: ["installed-integrations"],
      queryFn: getInstalledIntegrations,
      gcTime: Infinity,
    });
  }, []);

  useDestroyEditorBeforeChildren(editor);

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    syncEditable(editor, canType);
    if (showStatic) return;

    Object.assign(editor.storage, { pageId });
    editorRef.current = editor;
    const binding = { pageId, editor, editable: canType };
    setPageEditor(binding);
    return () => {
      setPageEditor((current) => (current === binding ? null : current));
    };
  }, [editor, pageId, setPageEditor, showStatic, canType]);

  const editorIsEditable = useEditorState({
    editor,
    selector: (ctx) => {
      return ctx.editor?.isEditable ?? false;
    },
  });

  const handleActiveCommentEvent = (event) => {
    const { commentId, resolved } = event.detail;

    if (resolved) {
      return;
    }

    setActiveCommentId(commentId);
    setCommentPanelTab("open");
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
    setLightboxRequest(null);
  }, [pageId]);

  const isSynced = isRemoteSynced;

  useEffect(() => {
    setYjsSynced(isSynced);
  }, [isSynced, setYjsSynced]);

  useEffect(() => {
    return () => setYjsSynced(false);
  }, [setYjsSynced]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (yjsConnectionStatus === WebSocketStatus.Connecting || !isSynced) {
        setYjsConnectionStatus(WebSocketStatus.Disconnected);
      }
    }, 7500);

    return () => clearTimeout(timeout);
  }, [yjsConnectionStatus, isSynced]);

  useSearchNavigationParams({
    editor,
    isSynced,
    pageId,
    searchParams,
    showStatic,
  });

  if (showStatic) {
    return null;
  }

  return (
    <div className="editor-container" style={{ position: "relative" }}>
      <div ref={menuContainerRef}>
        <EditorContent editor={editor} />

        {editor && (
          <SearchAndReplaceDialog
            editor={editor}
            editable={canType}
          />
        )}
        {editor && <SearchNavigationDialog editor={editor} />}

        <MicrosoftFullscreenModal />
        {editor && canType && editorIsEditable && (
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
            <IntegrationPasteMenu editor={editor} />
            <LinkPasteMenu editor={editor} />
            <BasePasteMenu editor={editor} />
            <MicrosoftFileMenu editor={editor} />
            <MicrosoftFolderMenu editor={editor} />
          </div>
        )}
        {editor && (!canType || !editorIsEditable) && (editable || canComment) && (
          <ReadonlyBubbleMenu editor={editor} />
        )}
        {editor && (
          <LightboxView
            editor={editor}
            open={!!lightboxRequest}
            src={lightboxRequest?.src ?? ""}
            type={lightboxRequest?.type ?? "image"}
            onClose={() => setLightboxRequest(null)}
          />
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
  const editor = useEditor({
    editable: false,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    textDirection: "auto",
    extensions: mainExtensions,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
      },
    },
  });
  useDestroyEditorBeforeChildren(editor);

  // EditorContent redraws the whole document when it adds the React node views,
  // so the content goes in after that and is drawn once.
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const doc = createDocument(
      content,
      editor.schema,
      editor.options.parseOptions,
    );
    editor.view.updateState(
      EditorState.create({ doc, plugins: editor.state.plugins }),
    );
  }, [editor]);

  useEditorScroll(editor);
  return <EditorContent editor={editor} />;
}
