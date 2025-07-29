import "@/features/editor/styles/index.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import {
  HocuspocusProvider,
  onAuthenticationFailedParameters,
  WebSocketStatus,
} from "@hocuspocus/provider";
import { EditorContent, EditorProvider, useEditor } from "@tiptap/react";
import {
  collabExtensions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { useAtom } from "jotai";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  pageEditorAtom,
  yjsConnectionStatusAtom,
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
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
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
import { useIdle } from "@/hooks/use-idle.ts";
import { queryClient } from "@/main.tsx";
import { IPage } from "@/features/page/types/page.types.ts";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { FIVE_MINUTES } from "@/lib/constants.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { jwtDecode } from "jwt-decode";

interface PageEditorProps {
  pageId: string;
  editable: boolean;
  content: any;
}

export default function PageEditor({
  pageId,
  editable,
  content,
}: PageEditorProps) {
  const collaborationURL = useCollaborationUrl();
  const [currentUser] = useAtom(currentUserAtom);
  const [, setEditor] = useAtom(pageEditorAtom);
  const [, setAsideState] = useAtom(asideStateAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const ydocRef = useRef<Y.Doc | null>(null);
  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }
  const ydoc = ydocRef.current;
  const [isLocalSynced, setLocalSynced] = useState(false);
  const [isRemoteSynced, setRemoteSynced] = useState(false);
  const [yjsConnectionStatus, setYjsConnectionStatus] = useAtom(
    yjsConnectionStatusAtom
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
    currentUser?.user?.settings?.preferences?.pageEditMode ?? PageEditMode.Edit;

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
      immediatelyRender: true,
      shouldRerenderOnTransaction: true,
      editorProps: {
        scrollThreshold: 80,
        scrollMargin: 80,
        handleDOMEvents: {
          keydown: (_view, event) => {
            if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
              event.preventDefault();
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
        }
      },
      onUpdate({ editor }) {
        if (editor.isEmpty) return;
        const editorJson = editor.getJSON();
        //update local page cache to reduce flickers
        debouncedUpdateContent(editorJson);
      },
    },
    [pageId, editable, remoteProvider]
  );

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
        handleActiveCommentEvent
      );
    };
  }, []);

  useEffect(() => {
    setActiveCommentId(null);
    setShowCommentPopup(false);
    setAsideState({ tab: "", isAsideOpen: false });
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
        immediatelyRender={true}
        extensions={mainExtensions}
        content={content}
      />
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div ref={menuContainerRef}>
        <EditorContent editor={editor} />

        {editor && (
          <SearchAndReplaceDialog editor={editor} editable={editable} />
        )}

        {editor && editor.isEditable && (
          <div>
            <EditorBubbleMenu editor={editor} />
            <TableMenu editor={editor} />
            <TableCellMenu editor={editor} appendTo={menuContainerRef} />
            <ImageMenu editor={editor} />
            <VideoMenu editor={editor} />
            <CalloutMenu editor={editor} />
            <ExcalidrawMenu editor={editor} />
            <DrawioMenu editor={editor} />
            <LinkMenu editor={editor} appendTo={menuContainerRef} />
          </div>
        )}
        {showCommentPopup && <CommentDialog editor={editor} pageId={pageId} />}
      </div>
      <div
        onClick={() => editor.commands.focus("end")}
        style={{ paddingBottom: "20vh" }}
      ></div>
    </div>
  );
}
