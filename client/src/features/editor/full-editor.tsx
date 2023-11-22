import classes from '@/features/editor/styles/editor.module.css';
import Editor from '@/features/editor/editor';
import React from 'react';
import { TitleEditor } from '@/features/editor/title-editor';

export interface FullEditorProps {
  pageId: string;
  title: any;
}

export function FullEditor({ pageId, title }: FullEditorProps) {

  return (
    <div className={classes.editor}>
      <TitleEditor pageId={pageId} title={title} />
      <Editor pageId={pageId} />
    </div>

  );
}
