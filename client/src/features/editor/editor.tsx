import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { authTokensAtom } from '@/features/auth/atoms/auth-tokens-atom';
import useCollaborationUrl from '@/features/editor/hooks/use-collaboration-url';
import { IndexeddbPersistence } from 'y-indexeddb';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { Superscript } from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { Typography } from '@tiptap/extension-typography';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import classes from '@/features/editor/styles/editor.module.css';
import '@/features/editor/styles/index.css';
import { TrailingNode } from '@/features/editor/extensions/trailing-node';
import DragAndDrop from '@/features/editor/extensions/drag-handle';
import { EditorBubbleMenu } from '@/features/editor/components/bubble-menu/bubble-menu';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import SlashCommand from '@/features/editor/extensions/slash-command';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { Heading } from '@tiptap/extension-heading';

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
  return (isSynced && <TiptapEditor ydoc={yDoc} provider={provider} />);
}

interface TiptapEditorProps {
  ydoc: Y.Doc,
  provider: HocuspocusProvider
}

function TiptapEditor({ ydoc, provider }: TiptapEditorProps) {
  const [currentUser] = useAtom(currentUserAtom);

  const extensions = [
    StarterKit.configure({
      history: false,
      dropcursor: {
        width: 3,
        color: '#70CFF8',
      },
    }),
    Collaboration.configure({
      document: ydoc,
    }),
    CollaborationCursor.configure({
      provider,
    }),
    Placeholder.configure({
      placeholder: 'Enter "/" for commands',
    }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Underline,
    Link,
    Superscript,
    SubScript,
    Highlight.configure({
      multicolor: true,
    }),
    Typography,
    TrailingNode,
    DragAndDrop,
    TextStyle,
    Color,
    SlashCommand,
  ];

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
  });

  useEffect(() => {
    // TODO: there must be a better way
    setTimeout(() => {
      titleEditor?.commands.focus('start');
      window.scrollTo(0, 0);
    }, 50);
  }, []);

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


  return (
    <>
      <div className={classes.editor}>
        {editor && <EditorBubbleMenu editor={editor} />}
        <EditorContent editor={titleEditor} onKeyDown={handleTitleKeyDown}
        />
        <EditorContent editor={editor} />
      </div>
    </>
  );
}
