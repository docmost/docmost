'use client';

import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useAtom } from 'jotai/index';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { authTokensAtom } from '@/features/auth/atoms/auth-tokens-atom';
import useCollaborationUrl from '@/features/editor/hooks/use-collaboration-url';
import '@/features/editor/css/editor.css';

interface EditorProps{
  pageId: string,
  token: string,
}

const colors = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D']
const getRandomElement = list => list[Math.floor(Math.random() * list.length)]
const getRandomColor = () => getRandomElement(colors)

export default function Editor({ pageId }: EditorProps ) {
  const [token] = useAtom(authTokensAtom);
  const collaborationURL = useCollaborationUrl();

  const [provider, setProvider] = useState<any>();
  const [doc, setDoc] = useState<Y.Doc>()

  useLayoutEffect(() => {
    if (token) {
      const ydoc = new Y.Doc();

      const provider = new HocuspocusProvider({
        url: collaborationURL,
        name: pageId,
        document: ydoc,
        token: token.accessToken,
      });

      setDoc(ydoc);
      setProvider(provider);

      return () => {
        ydoc.destroy();
        provider.destroy();
      };
    }
  }, [collaborationURL, pageId, token]);

  if(!doc || !provider){
    return null;
  }

  return (
    <TiptapEditor ydoc={doc} provider={provider} />
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
      provider
    }),
  ];

  const editor = useEditor({
    extensions: extensions,
    editorProps: {
      attributes: {
        class:
          "min-h-[500px] flex-1 p-4",
      },
    },
  });

  useEffect(() => {
    if (editor && currentUser.user){
      editor.chain().focus().updateUser({...currentUser.user, color: getRandomColor()}).run()
    }
  }, [editor, currentUser.user])

  useEffect(() => {
    provider.on('status', event => {
      console.log(event)
    })

  }, [provider])


  return (
    <>
      <EditorContent editor={editor} />
    </>
  );
}
