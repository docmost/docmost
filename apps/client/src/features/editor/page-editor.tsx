import "@/features/editor/styles/index.css";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
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
import { asideStateAtom } from "@/components/navbar/atoms/sidebar-atom";
import {
  activeCommentIdAtom,
  showCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import CommentDialog from "@/features/comment/components/comment-dialog";
import EditorSkeleton from "@/features/editor/components/editor-skeleton";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";

interface PageEditorProps {
  pageId: string;
  editable?: boolean;
}

export default function PageEditor({
  pageId,
  editable = true,
}: PageEditorProps) {
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
    ...mainExtensions,
    ...collabExtensions(remoteProvider, currentUser.user),
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
      },
      onCreate({ editor }) {
        if (editor) {
          // @ts-ignore
          setEditor(editor);
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
        <div>
          <EditorContent editor={editor} />

          {editor && editor.isEditable && (
            <div>
              <EditorBubbleMenu editor={editor} />
            </div>
          )}

          {showCommentPopup && (
            <CommentDialog editor={editor} pageId={pageId} />
          )}
        </div>
      )}
    </div>
  ) : (
    <EditorSkeleton />
  );
}
