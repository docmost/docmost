import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { EditorContent, useEditor } from '@tiptap/react';
import { Placeholder } from '@tiptap/extension-placeholder';
import React, { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { authTokensAtom } from '@/features/auth/atoms/auth-tokens-atom';
import useCollaborationUrl from '@/features/editor/hooks/use-collaboration-url';
import { IndexeddbPersistence } from 'y-indexeddb';
import classes from '@/features/editor/styles/editor.module.css';
import '@/features/editor/styles/index.css';
import { EditorBubbleMenu } from '@/features/editor/components/bubble-menu/bubble-menu';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { Heading } from '@tiptap/extension-heading';
import usePage from '@/features/page/hooks/use-page';
import { useDebouncedValue } from '@mantine/hooks';
import { pageAtom } from '@/features/page/atoms/page-atom';
import { IPage } from '@/features/page/types/page.types';
import { Comment } from '@/features/editor/extensions/comment/comment';
import { desktopAsideAtom } from '@/components/navbar/atoms/sidebar-atom';
import { activeCommentIdAtom, showCommentPopupAtom } from '@/features/comment/atoms/comment-atom';
import CommentDialog from '@/features/comment/components/comment-dialog';
import { editorAtom } from '@/features/editor/atoms/editorAtom';
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
  const [page, setPage] = useAtom(pageAtom<IPage>(pageId));
  const [debouncedTitleState, setDebouncedTitleState] = useState('');
  const [debouncedTitle] = useDebouncedValue(debouncedTitleState, 1000);
  const { updatePageMutation } = usePage();
  const [desktopAsideOpened, setDesktopAsideOpened] = useAtom<boolean>(desktopAsideAtom);
  const [activeCommentId, setActiveCommentId] = useAtom<string | null>(activeCommentIdAtom);
  const [showCommentPopup, setShowCommentPopup] = useAtom<boolean>(showCommentPopupAtom);

  const titleEditor = useEditor({
    extensions: [
      Document.extend({
        content: 'heading',
      }),
      Heading.configure({
        levels: [1],
      }),
      Text,
      Placeholder.configure({
        placeholder: 'Untitled',
      }),
    ],
    onUpdate({ editor }) {
      const currentTitle = editor.getText();
      setDebouncedTitleState(currentTitle);
    },
    content: page.title,
  });

  useEffect(() => {
    setTimeout(() => {
      titleEditor?.commands.focus('start');
      window.scrollTo(0, 0);
    }, 100);
  }, []);

  useEffect(() => {
    if (debouncedTitle !== '') {
      updatePageMutation({ id: pageId, title: debouncedTitle });
    }
  }, [debouncedTitle]);

  const extensions = [
    ...mainExtensions,
    ...collabExtensions(ydoc, provider),
    Comment.configure({
      HTMLAttributes: {
        class: 'comment-mark',
      },
    }),

  ];

  const editor = useEditor({
    extensions: extensions,
    autofocus: false,
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
    if (editor && currentUser.user) {
      editor.chain().focus().updateUser({ ...currentUser.user, color: getRandomColor() }).run();
    }
  }, [editor, currentUser.user]);

  function handleTitleKeyDown(event) {
    if (!titleEditor || !editor || event.shiftKey) return;

    const { key } = event;
    const { $head } = titleEditor.state.selection;

    const shouldFocusEditor = (key === 'Enter' || key === 'ArrowDown') ||
      (key === 'ArrowRight' && !$head.nodeAfter);

    if (shouldFocusEditor) {
      editor.commands.focus('start');
    }
  }

  const handleActiveCommentEvent = (event) => {
    const { commentId } = event.detail;
    setActiveCommentId(commentId);
    setDesktopAsideOpened(true);

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
    setDesktopAsideOpened(false);
    setShowCommentPopup(false);
  }, [pageId]);

  return (
    <>
      <div className={classes.editor}>
        {editor && <EditorBubbleMenu editor={editor} />}
        <EditorContent editor={titleEditor} onKeyDown={handleTitleKeyDown} />
        <EditorContent editor={editor} />
      </div>

      {showCommentPopup && (
        <CommentDialog editor={editor} pageId={pageId} />
      )}
    </>
  );
}
