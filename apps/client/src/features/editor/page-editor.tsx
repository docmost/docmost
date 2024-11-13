import "@/features/editor/styles/index.css";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  collabExtensions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { useAtom } from "jotai";
import { authTokensAtom } from "@/features/auth/atoms/auth-tokens-atom";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import {
  activeCommentIdAtom,
  showCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import CommentDialog from "@/features/comment/components/comment-dialog";
import EditorSkeleton from "@/features/editor/components/editor-skeleton";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import TableCellMenu from "@/features/editor/components/table/table-cell-menu.tsx";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import {
  handleFileDrop,
  handleFilePaste,
} from "@/features/editor/components/common/file-upload-handler.tsx";
import LinkMenu from "@/features/editor/components/link/link-menu.tsx";
import ExcalidrawMenu from "./components/excalidraw/excalidraw-menu";
import DrawioMenu from "./components/drawio/drawio-menu";

interface PageEditorProps {
  pageId: string;
  editable: boolean;
}

export default function PageEditor({ pageId, editable }: PageEditorProps) {
  const [token] = useAtom(authTokensAtom);
  const collaborationURL = useCollaborationUrl();
  const [currentUser] = useAtom(currentUserAtom);
  const [, setEditor] = useAtom(pageEditorAtom);
  const [, setAsideState] = useAtom(asideStateAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const ydoc = useMemo(() => new Y.Doc(), [pageId]);
  const [isLocalSynced, setLocalSynced] = useState(false);
  const [isRemoteSynced, setRemoteSynced] = useState(false);
  const documentName = `page.${pageId}`;
  const menuContainerRef = useRef(null);

  const localProvider = useMemo(() => {
    const provider = new IndexeddbPersistence(documentName, ydoc);

    provider.on("synced", () => {
      setLocalSynced(true);
    });

    return provider;
  }, [pageId, ydoc]);

  const remoteProvider = useMemo(() => {
    const provider = new HocuspocusProvider({
      name: documentName,
      url: collaborationURL,
      document: ydoc,
      token: token?.accessToken,
      connect: false,
    });

    provider.on("synced", () => {
      setRemoteSynced(true);
    });

    return provider;
  }, [ydoc, pageId, token?.accessToken]);

  useLayoutEffect(() => {
    remoteProvider.connect();

    return () => {
      setRemoteSynced(false);
      setLocalSynced(false);
      remoteProvider.destroy();
      localProvider.destroy();
    };
  }, [remoteProvider, localProvider]);

  const extensions = [
    ... mainExtensions,
    ... collabExtensions(remoteProvider, currentUser.user),
  ];

  const editor = useEditor(
    {
      extensions,
      editable,
      editorProps: {
        handleDOMEvents: {
          keydown: (_view, event) => {
            if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
              const slashCommand = document.querySelector("#slash-command");
              if (slashCommand) {
                return true;
              }
            }
          },
        },
        handlePaste: (view, event) => handleFilePaste(view, event, pageId),
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
    },
    [pageId, editable, remoteProvider],
  );

  const handleActiveCommentEvent = (event) => {
    const { commentId } = event.detail;
    setActiveCommentId(commentId);
    setAsideState({ tab: "comments", isAsideOpen: true });

    const selector = `div[data-comment-id="${commentId}"]`;
    const commentElement = document.querySelector(selector);
    commentElement?.scrollIntoView();
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

  const isSynced = isLocalSynced || isRemoteSynced;

  return isSynced ? (
    <div>
      {isSynced && (
        <div ref={menuContainerRef}>
          <EditorContent editor={editor} />

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

          {showCommentPopup && (
            <CommentDialog editor={editor} pageId={pageId} />
          )}
        </div>
      )}
      <div onClick={() => editor.commands.focus('end')} style={{ paddingBottom: '20vh' }}></div>
    </div>
  ) : (
    <EditorSkeleton />
  );
}
