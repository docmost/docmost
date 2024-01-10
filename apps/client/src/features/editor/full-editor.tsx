import classes from '@/features/editor/styles/editor.module.css';
import React from 'react';
import { TitleEditor } from '@/features/editor/title-editor';
import PageEditor from '@/features/editor/page-editor';

export interface FullEditorProps {
  pageId: string;
  title: any;
}

export function FullEditor({ pageId, title }: FullEditorProps) {

  return (
    <div className={classes.editor}>
      <TitleEditor pageId={pageId} title={title} />
      <PageEditor pageId={pageId} />
    </div>

  );
}
