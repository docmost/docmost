import '@/features/editor/styles/index.css';
import React, { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Heading } from '@tiptap/extension-heading';
import { Text } from '@tiptap/extension-text';
import { Placeholder } from '@tiptap/extension-placeholder';
import { useAtomValue } from 'jotai';
import { editorAtom, titleEditorAtom } from '@/features/editor/atoms/editorAtom';
import { useUpdatePageMutation } from '@/features/page/queries/page-query';
import { useDebouncedValue } from '@mantine/hooks';
import { useAtom } from 'jotai';

export interface TitleEditorProps {
  pageId: string;
  title: any;
}

export function TitleEditor({ pageId, title }: TitleEditorProps) {
  const [debouncedTitleState, setDebouncedTitleState] = useState('');
  const [debouncedTitle] = useDebouncedValue(debouncedTitleState, 1000);
  const updatePageMutation = useUpdatePageMutation();
  const contentEditor = useAtomValue(editorAtom);
  const [, setTitleEditor] = useAtom(titleEditorAtom);

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
    onCreate({ editor }) {
      if (editor) {
        // @ts-ignore
        setTitleEditor(editor);
      }
    },
    onUpdate({ editor }) {
      const currentTitle = editor.getText();
      setDebouncedTitleState(currentTitle);
    },
    content: title,
  });

  useEffect(() => {
    if (debouncedTitle !== '') {
      updatePageMutation.mutate({ id: pageId, title: debouncedTitle });
    }
  }, [debouncedTitle]);

  function handleTitleKeyDown(event) {
    if (!titleEditor || !contentEditor || event.shiftKey) return;

    const { key } = event;
    const { $head } = titleEditor.state.selection;

    const shouldFocusEditor = (key === 'Enter' || key === 'ArrowDown') ||
      (key === 'ArrowRight' && !$head.nodeAfter);

    if (shouldFocusEditor) {
      contentEditor.commands.focus('start');
    }
  }

  return (
    <EditorContent editor={titleEditor} onKeyDown={handleTitleKeyDown} />
  );
}
