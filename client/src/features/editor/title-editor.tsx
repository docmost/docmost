import '@/features/editor/styles/index.css';
import React, { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Heading } from '@tiptap/extension-heading';
import { Text } from '@tiptap/extension-text';
import { Placeholder } from '@tiptap/extension-placeholder';
import { useAtomValue } from 'jotai';
import { pageEditorAtom, titleEditorAtom } from '@/features/editor/atoms/editor-atoms';
import { useUpdatePageMutation } from '@/features/page/queries/page-query';
import { useDebouncedValue } from '@mantine/hooks';
import { useAtom } from 'jotai';
import { treeDataAtom } from '@/features/page/tree/atoms/tree-data-atom';
import { updateTreeNodeName } from '@/features/page/tree/utils';

export interface TitleEditorProps {
  pageId: string;
  title: any;
}

export function TitleEditor({ pageId, title }: TitleEditorProps) {
  const [debouncedTitleState, setDebouncedTitleState] = useState('');
  const [debouncedTitle] = useDebouncedValue(debouncedTitleState, 1000);
  const updatePageMutation = useUpdatePageMutation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const [, setTitleEditor] = useAtom(titleEditorAtom);
  const [treeData, setTreeData] = useAtom(treeDataAtom);

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

      const newTreeData = updateTreeNodeName(treeData, pageId, debouncedTitle);
      setTreeData(newTreeData);
    }
  }, [debouncedTitle]);

  useEffect(() => {
    if (titleEditor && title !== titleEditor.getText()) {
      titleEditor.commands.setContent(title);
    }
  }, [pageId, title, titleEditor]);

  useEffect(() => {
    setTimeout(() => {
      titleEditor?.commands.focus('end');
    }, 500);
  }, [titleEditor]);

  function handleTitleKeyDown(event) {
    if (!titleEditor || !pageEditor || event.shiftKey) return;

    const { key } = event;
    const { $head } = titleEditor.state.selection;

    const shouldFocusEditor = (key === 'Enter' || key === 'ArrowDown') ||
      (key === 'ArrowRight' && !$head.nodeAfter);

    if (shouldFocusEditor) {
      pageEditor.commands.focus('start');
    }
  }

  return (
    <EditorContent editor={titleEditor} onKeyDown={handleTitleKeyDown} />
  );
}
