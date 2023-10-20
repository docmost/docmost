import '@/features/editor/styles/editor.css';

import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { authTokensAtom } from '@/features/auth/atoms/auth-tokens-atom';
import useCollaborationUrl from '@/features/editor/hooks/use-collaboration-url';
import { IndexeddbPersistence } from 'y-indexeddb';
import { RichTextEditor } from '@mantine/tiptap';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { Superscript } from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';

interface EditorProps {
  pageId: string,
  token?: string,
}

const colors = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D'];
const getRandomElement = list => list[Math.floor(Math.random() * list.length)];
const getRandomColor = () => getRandomElement(colors);

export default function Editor({ pageId }: EditorProps) {
  const [token] = useAtom(authTokensAtom);
  const collaborationURL = useCollaborationUrl();
  const [provider, setProvider] = useState<any>();
  const [yDoc] = useState(() => new Y.Doc());


  useEffect(() => {
    if (token) {
      const indexeddbProvider = new IndexeddbPersistence(pageId, yDoc)
      const provider = new HocuspocusProvider({
        url: collaborationURL,
        name: pageId,
        document: yDoc,
        token: token.accessToken,
      });

      setProvider(provider);

      return () => {
        provider.destroy();
        setProvider(null);
        indexeddbProvider.destroy();
      };
    }
  }, [pageId, token]);

  if (!provider) {
    return null;
  }

  return (
    <TiptapEditor ydoc={yDoc} provider={provider} />
  );
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
    }),
    Placeholder.configure({
      placeholder: 'Write here',
    }),
    Collaboration.configure({
      document: ydoc,
    }),
    CollaborationCursor.configure({
      provider,
    }),
    Underline,
    Link,
    Superscript,
    SubScript,
    Highlight,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ];

  const editor = useEditor({
    extensions: extensions,
  });

  useEffect(() => {
    if (editor && currentUser.user) {
      editor.chain().focus().updateUser({ ...currentUser.user, color: getRandomColor() }).run();
    }
  }, [editor, currentUser.user]);

  useEffect(() => {
    provider.on('status', event => {
      console.log(event);
    });

  }, [provider]);


  return (
    <RichTextEditor editor={editor}>
      <RichTextEditor.Toolbar sticky stickyOffset={60}>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Underline />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.ClearFormatting />
          <RichTextEditor.Highlight />
          <RichTextEditor.Code />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.H1 />
          <RichTextEditor.H2 />
          <RichTextEditor.H3 />
          <RichTextEditor.H4 />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Blockquote />
          <RichTextEditor.Hr />
          <RichTextEditor.BulletList />
          <RichTextEditor.OrderedList />
          <RichTextEditor.Subscript />
          <RichTextEditor.Superscript />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>

        <RichTextEditor.ControlsGroup>
          <RichTextEditor.AlignLeft />
          <RichTextEditor.AlignCenter />
          <RichTextEditor.AlignJustify />
          <RichTextEditor.AlignRight />
        </RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>

      <RichTextEditor.Content />
    </RichTextEditor>
  );
}
