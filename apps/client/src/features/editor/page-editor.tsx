import "@/features/editor/styles/index.css";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { useTranslation } from "react-i18next";
import {
  HocuspocusProvider,
  onAuthenticationFailedParameters,
  WebSocketStatus,
} from "@hocuspocus/provider";
import {
  EditorContent,
  EditorProvider,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import {
  collabExtensions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { useAtom, useSetAtom } from "jotai";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { currentUserAtom, userAtom } from "@/features/user/atoms/current-user-atom";
import {
  pageEditorAtom,
  yjsConnectionStatusAtom,
  hasUnsavedChangesAtom,
} from "@/features/editor/atoms/editor-atoms";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import {
  activeCommentIdAtom,
  showCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import CommentDialog from "@/features/comment/components/comment-dialog";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import TableCellMenu from "@/features/editor/components/table/table-cell-menu.tsx";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import SubpagesMenu from "@/features/editor/components/subpages/subpages-menu.tsx";
import ColumnMenu from "@/features/editor/components/columns/column-menu.tsx";
import {
  handleFileDrop,
  handlePaste,
} from "@/features/editor/components/common/editor-paste-handler.tsx";
import LinkMenu from "@/features/editor/components/link/link-menu.tsx";
import ExcalidrawMenu from "./components/excalidraw/excalidraw-menu";
import DrawioMenu from "./components/drawio/drawio-menu";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import SearchAndReplaceDialog from "@/features/editor/components/search-and-replace/search-and-replace-dialog.tsx";
import { useDebouncedCallback, useDocumentVisibility } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useIdle } from "@/hooks/use-idle.ts";
import { queryClient } from "@/main.tsx";
import { IPage } from "@/features/page/types/page.types.ts";
import { useUpdatePageMutation } from "@/features/page/queries/page-query";
import { updateUser } from "@/features/user/services/user-service";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { FIVE_MINUTES } from "@/lib/constants.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { jwtDecode } from "jwt-decode";
import { searchSpotlight } from "@/features/search/constants.ts";
import { useEditorScroll } from "./hooks/use-editor-scroll";

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
  canComment = false,
}: PageEditorProps) {
  const { t } = useTranslation();
  const collaborationURL = useCollaborationUrl();
  const isComponentMounted = useRef(false);
  const editorCreated = useRef(false);

  const [currentUser] = useAtom(currentUserAtom);
  const [, setUser] = useAtom(userAtom);
  const setEditor = useSetAtom(pageEditorAtom as any);
  const [, setAsideState] = useAtom(asideStateAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom);
  const [hasUnsavedChanges] = useAtom(hasUnsavedChangesAtom);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      // CLEAR GLOBAL STATE ON UNMOUNT to avoid leakage to next page
      setEditor(null);
      setHasUnsavedChanges(false);
    };
  }, []);
  const ydocRef = useRef<Y.Doc | null>(null);
  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }
  const ydoc = ydocRef.current;
  const [isLocalSynced, setLocalSynced] = useState(false);
  const [isRemoteSynced, setRemoteSynced] = useState(false);
  const [yjsConnectionStatus, setYjsConnectionStatus] = useAtom(
    yjsConnectionStatusAtom,
  );
  const menuContainerRef = useRef(null);
  const documentName = `page.${pageId}`;
  const { data: collabQuery, refetch: refetchCollabToken } = useCollabToken();
  const { isIdle, resetIdle } = useIdle(FIVE_MINUTES, { initialState: false });
  const documentState = useDocumentVisibility();
  const [isCollabReady, setIsCollabReady] = useState(false);
  const { pageSlug } = useParams();
  const slugId = extractPageSlugId(pageSlug);
  const userPageEditMode =
    currentUser?.user?.settings?.preferences?.pageEditMode ?? PageEditMode.Read;

  const canScroll = useCallback(
    () => isComponentMounted.current && editorCreated.current,
    [isComponentMounted, editorCreated],
  );
  const initialScrollTo = window.location.hash
    ? window.location.hash.slice(1)
    : "";

  const { handleScrollTo } = useEditorScroll({ canScroll, initialScrollTo });
  // Providers only created once per pageId
  const providersRef = useRef<{
    local: IndexeddbPersistence;
    remote: HocuspocusProvider;
  } | null>(null);
  const [providersReady, setProvidersReady] = useState(false);

  const localProvider = providersRef.current?.local;
  const remoteProvider = providersRef.current?.remote;

  // Track when collaborative provider is ready and synced
  const [collabReady, setCollabReady] = useState(false);
  useEffect(() => {
    if (
      remoteProvider?.status === WebSocketStatus.Connected &&
      isLocalSynced &&
      isRemoteSynced
    ) {
      setCollabReady(true);
    }
  }, [remoteProvider?.status, isLocalSynced, isRemoteSynced]);

  useEffect(() => {
    if (!providersRef.current) {
      const local = new IndexeddbPersistence(documentName, ydoc);
      local.on("synced", () => setLocalSynced(true));
      const remote = new HocuspocusProvider({
        name: documentName,
        url: collaborationURL,
        document: ydoc,
        token: collabQuery?.token,
        connect: true,
        preserveConnection: false,
        onAuthenticationFailed: (auth: onAuthenticationFailedParameters) => {
          const payload = jwtDecode(collabQuery?.token);
          const now = Date.now().valueOf() / 1000;
          const isTokenExpired = now >= payload.exp;
          if (isTokenExpired) {
            refetchCollabToken().then((result) => {
              if (result.data?.token) {
                remote.disconnect();
                setTimeout(() => {
                  remote.configuration.token = result.data.token;
                  remote.connect();
                }, 100);
              }
            });
          }
        },
        onStatus: (status) => {
          if (status.status === "connected") {
            setYjsConnectionStatus(status.status);
          }
        },
      });
      remote.on("synced", () => setRemoteSynced(true));
      remote.on("disconnect", () => {
        setYjsConnectionStatus(WebSocketStatus.Disconnected);
      });
      providersRef.current = { local, remote };
      setProvidersReady(true);
    } else {
      setProvidersReady(true);
    }
    // Only destroy on final unmount
    return () => {
      providersRef.current?.remote.destroy();
      providersRef.current?.local.destroy();
      providersRef.current = null;
    };
  }, [pageId]);

  /*
  useEffect(() => {
    // Handle token updates by reconnecting with new token
    if (providersRef.current?.remote && collabQuery?.token) {
      const currentToken = providersRef.current.remote.configuration.token;
      if (currentToken !== collabQuery.token) {
        // Token has changed, need to reconnect with new token
        providersRef.current.remote.disconnect();
        providersRef.current.remote.configuration.token = collabQuery.token;
        providersRef.current.remote.connect();
      }
    }
  }, [collabQuery?.token]);
   */

  // Only connect/disconnect on tab/idle, not destroy
  useEffect(() => {
    if (!providersReady || !providersRef.current) return;
    const remoteProvider = providersRef.current.remote;
    if (
      isIdle &&
      documentState === "hidden" &&
      remoteProvider.status === WebSocketStatus.Connected
    ) {
      remoteProvider.disconnect();
      setIsCollabReady(false);
      return;
    }
    if (
      documentState === "visible" &&
      remoteProvider.status === WebSocketStatus.Disconnected
    ) {
      resetIdle();
      remoteProvider.connect();
      setTimeout(() => setIsCollabReady(true), 500);
    }
  }, [isIdle, documentState, providersReady, resetIdle]);

  const extensions = useMemo(() => {
    if (!remoteProvider || !currentUser?.user) return mainExtensions;
    return [
      ...mainExtensions,
      ...collabExtensions(remoteProvider, currentUser?.user),
    ];
  }, [remoteProvider, currentUser?.user]);

  const editor = useEditor(
    {
      extensions,
      editable,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        scrollThreshold: 80,
        scrollMargin: 80,
        handleDOMEvents: {
          keydown: (_view, event) => {
            if ((event.ctrlKey || event.metaKey) && event.code === "KeyS") {
              event.preventDefault();
              return true;
            }
            if ((event.ctrlKey || event.metaKey) && event.code === "KeyK") {
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
        handlePaste: (view, event, slice) =>
          handlePaste(view, event, pageId, currentUser?.user.id),
        handleDrop: (view, event, _slice, moved) =>
          handleFileDrop(view, event, moved, pageId),
      },
      onCreate({ editor }) {
        if (editor) {
          // @ts-ignore
          setEditor(editor);
          editor.storage.pageId = pageId;
          handleScrollTo(editor);
          editorCreated.current = true;
        }
      },
      onUpdate({ editor, transaction }) {
        if (editor.isEmpty || !transaction.docChanged) return;
        const editorJson = editor.getJSON();
        //update local page cache to reduce flickers
        debouncedUpdateContent(editorJson);

        // Only mark unsaved changes if collab is ready and it's a local change
        // AND the editor is in explicit edit mode (not quick-edit in read mode)
        if (isCollabReady && transaction.getMeta("y-sync$") === undefined && editor.isEditable) {
          setHasUnsavedChanges(true);
        }
      },
    },
    [pageId, editable, remoteProvider],
  );

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
        updatedAt: new Date(),
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
    setHasUnsavedChanges(false);
  }, [pageId]);

  useEffect(() => {
    if (remoteProvider?.status === WebSocketStatus.Connecting) {
      const timeout = setTimeout(() => {
        setYjsConnectionStatus(WebSocketStatus.Disconnected);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [remoteProvider?.status]);

  const isSynced = isLocalSynced && isRemoteSynced;

  useEffect(() => {
    const collabReadyTimeout = setTimeout(() => {
      if (
        !isCollabReady &&
        isSynced &&
        remoteProvider?.status === WebSocketStatus.Connected
      ) {
        setIsCollabReady(true);
      }
    }, 500);
    return () => clearTimeout(collabReadyTimeout);
  }, [isRemoteSynced, isLocalSynced, remoteProvider?.status]);

  useEffect(() => {
    // Only honor user default page edit mode preference and permissions
    if (editor) {
      if (userPageEditMode && editable) {
        if (userPageEditMode === PageEditMode.Edit) {
          editor.setEditable(true);
        } else if (userPageEditMode === PageEditMode.Read) {
          editor.setEditable(false);
        }
      } else {
        editor.setEditable(false);
      }
    }
  }, [userPageEditMode, editor, editable]);

  const updatePageMutation = useUpdatePageMutation();
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    // Force Read mode on initial load
    if (userPageEditMode === PageEditMode.Edit && editable) {
      updateUser({ pageEditMode: PageEditMode.Read }).then((updatedUser) => {
        setUser(updatedUser);
      });
    }
  }, []); // Only on mount/load

  useEffect(() => {
    const handleExitSave = () => {
      const isExitingOrNavigating = !isComponentMounted.current;

      // If in Edit mode and either navigating away or refresing
      if (userPageEditMode === PageEditMode.Edit && editable) {
        // 1. Save changes ONLY if there are any and the editor belongs to this page
        const editorPageId = editor?.storage?.pageId;
        if (hasUnsavedChangesRef.current && editor && pageId && editorPageId === pageId) {
          const content = editor.getJSON();
          updatePageMutation.mutate({
            pageId,
            content,
            forceHistorySave: true,
          });
          setHasUnsavedChanges(false);
        }

        // 2. Always switch user preference to Read mode if we are leaving this specific editor instance
        if (isExitingOrNavigating) {
          updateUser({ pageEditMode: PageEditMode.Read }).then((updatedUser) => {
            setUser(updatedUser);
          });
        }
      }
    };

    const handleBeforeUnload = () => {
      // For window close/refresh, we use fetch with keepalive to ensure the preference update reaches the server
      if (userPageEditMode === PageEditMode.Edit && editable) {
        // Attempt to save changes and force history if there are unsaved changes
        const editorPageId = editor?.storage?.pageId;
        if (hasUnsavedChangesRef.current && editor && pageId && editorPageId === pageId) {
          const content = editor.getJSON();
          const saveBody = JSON.stringify({
            pageId,
            content,
            forceHistorySave: true,
          });

          fetch("/api/pages/update", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: saveBody,
            keepalive: true,
          });
        }

        // Also update the mode preference to Read
        const prefBody = JSON.stringify({ pageEditMode: PageEditMode.Read });
        fetch("/api/users/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: prefBody,
          keepalive: true,
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      handleExitSave();
    };
  }, [
    pageId,
    userPageEditMode,
    editor,
    editable,
    setHasUnsavedChanges,
  ]);

  const hasConnectedOnceRef = useRef(false);
  const [showStatic, setShowStatic] = useState(true);

  useEffect(() => {
    if (
      !hasConnectedOnceRef.current &&
      remoteProvider?.status === WebSocketStatus.Connected
    ) {
      hasConnectedOnceRef.current = true;
      setShowStatic(false);
    }
  }, [remoteProvider?.status]);

  if (showStatic) {
    return (
      <EditorProvider
        editable={false}
        immediatelyRender={false}
        extensions={mainExtensions}
        content={content}
      />
    );
  }

  return (
    <div className="editor-container" style={{ position: "relative" }}>
      <div ref={menuContainerRef}>
        <EditorContent editor={editor} />

        {editor && (
          <SearchAndReplaceDialog editor={editor} editable={editable} />
        )}

        {editor && (editorIsEditable || canComment) && (
          <div>
            <EditorBubbleMenu editor={editor} canComment={canComment} />
          </div>
        )}
        {editor && editorIsEditable && (
          <div>
            <TableMenu editor={editor} />
            <TableCellMenu editor={editor} appendTo={menuContainerRef} />
            <VideoMenu editor={editor} />
            <CalloutMenu editor={editor} />
            <SubpagesMenu editor={editor} />
            <ColumnMenu editor={editor} />
            <ExcalidrawMenu editor={editor} />
            <DrawioMenu editor={editor} />
            <LinkMenu editor={editor} appendTo={menuContainerRef} />
          </div>
        )}
        {showCommentPopup && <CommentDialog editor={editor} pageId={pageId} />}
      </div>
      <div
        onClick={() => editor?.commands.focus("end")}
        style={{ paddingBottom: "20vh" }}
      ></div>
    </div>
  );
}
