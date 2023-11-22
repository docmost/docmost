import '@/features/editor/styles/index.css';

import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { EditorContent, useEditor } from '@tiptap/react';
import React, { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { authTokensAtom } from '@/features/auth/atoms/auth-tokens-atom';
import useCollaborationUrl from '@/features/editor/hooks/use-collaboration-url';
import { IndexeddbPersistence } from 'y-indexeddb';
import { EditorBubbleMenu } from '@/features/editor/components/bubble-menu/bubble-menu';
import { asideStateAtom } from '@/components/navbar/atoms/sidebar-atom';
import { activeCommentIdAtom, showCommentPopupAtom } from '@/features/comment/atoms/comment-atom';
import CommentDialog from '@/features/comment/components/comment-dialog';
import { editorAtom, titleEditorAtom } from '@/features/editor/atoms/editorAtom';
import { collabExtensions, mainExtensions } from '@/features/editor/extensions';

interface EditorProps {
  pageId: string,
}

const colors = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D'];
const getRandomElement = list => list[Math.floor(Math.random() * list.length)];
const getRandomColor = () => getRandomElement(colors);

export default function Editor({ pageId }: EditorProps) {
  const [token] = useAtom(authTokensAtom);
  const collaborationURL = useCollaborationUrl();
  const [provider, setProvider] = useState<any>();
  const [yDoc] = useState(() => new Y.Doc());
  const [isLocalSynced, setLocalSynced] = useState(false);
  const [isRemoteSynced, setRemoteSynced] = useState(false);

  useEffect(() => {
    if (token) {
      const indexeddbProvider = new IndexeddbPersistence(pageId, yDoc);

      const provider = new HocuspocusProvider({
        url: collaborationURL,
        name: pageId,
        document: yDoc,
        token: token.accessToken,
      });

      indexeddbProvider.on('synced', () => {
        console.log('index synced');
        setLocalSynced(true);
      });

      provider.on('synced', () => {
        console.log('remote synced');
        setRemoteSynced(true);
      });

      setProvider(provider);
      return () => {
        setProvider(null);
        provider.destroy();
        indexeddbProvider.destroy();
        setRemoteSynced(false);
        setLocalSynced(false);
      };
    }
  }, [pageId, token]);

  if (!provider) {
    return null;
  }

  const isSynced = isLocalSynced || isRemoteSynced;
  if (isSynced){
    window.scrollTo(0, 0);
  }
  return (isSynced && <TiptapEditor ydoc={yDoc} provider={provider} pageId={pageId} />);
}

interface TiptapEditorProps {
  ydoc: Y.Doc,
  provider: HocuspocusProvider,
  pageId: string,
}

function TiptapEditor({ ydoc, provider, pageId }: TiptapEditorProps) {
  const [currentUser] = useAtom(currentUserAtom);
  const [, setEditor] = useAtom(editorAtom);
  const [titleEditor] = useAtom(titleEditorAtom);
  const [asideState, setAsideState] = useAtom(asideStateAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);

  const extensions = [
    ...mainExtensions,
    ...collabExtensions(ydoc, provider),
  ];

  const editor = useEditor({
    extensions: extensions,
    autofocus: 0,
    editorProps: {
      handleDOMEvents: {
        keydown: (_view, event) => {
          if (['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) {
            const slashCommand = document.querySelector('#slash-command');
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
    onUpdate({ editor }) {
      const { selection } = editor.state;
      if (!selection.empty) {
        return;
      }

      const viewportCoords = editor.view.coordsAtPos(selection.from);
      const absoluteOffset = window.scrollY + viewportCoords.top;
      window.scrollTo(
        window.scrollX,
        absoluteOffset - (window.innerHeight / 2),
      );
    },
  });

  useEffect(() => {
    setTimeout(() => {
     titleEditor?.commands.focus('end');
    }, 200);
  }, [editor]);

  useEffect(() => {
    if (editor && currentUser.user) {
      editor.chain().focus().updateUser({ ...currentUser.user, color: getRandomColor() }).run();
    }
  }, [editor, currentUser.user]);

  const handleActiveCommentEvent = (event) => {
    const { commentId } = event.detail;
    setActiveCommentId(commentId);
    setAsideState({ tab: 'comments', isAsideOpen: true });

    const selector = `div[data-comment-id="${commentId}"]`;
    const commentElement = document.querySelector(selector);
    commentElement?.scrollIntoView();
  };

  useEffect(() => {
    document.addEventListener('ACTIVE_COMMENT_EVENT', handleActiveCommentEvent);
    return () => {
      document.removeEventListener('ACTIVE_COMMENT_EVENT', handleActiveCommentEvent);
    };
  }, []);

  useEffect(() => {
    setActiveCommentId(null);
    setShowCommentPopup(false);
    setAsideState({ tab: '', isAsideOpen: false });
  }, [pageId]);

  return (
    <div>
      {editor &&
        (<div>
          <EditorBubbleMenu editor={editor} />
          <EditorContent editor={editor} />

          {showCommentPopup && (
            <CommentDialog editor={editor} pageId={pageId} />
          )}
        </div>)}
    </div>
  );
}

