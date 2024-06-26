import classes from "@/features/editor/styles/editor.module.css";
import React from "react";
import { TitleEditor } from "@/features/editor/title-editor";
import PageEditor from "@/features/editor/page-editor";

const MemoizedTitleEditor = React.memo(TitleEditor);
const MemoizedPageEditor = React.memo(PageEditor);

export interface FullEditorProps {
  pageId: string;
  slugId: string;
  title: string;
  spaceSlug: string;
  editable: boolean;
}

export function FullEditor({
  pageId,
  title,
  slugId,
  spaceSlug,
  editable,
}: FullEditorProps) {
  return (
    <div className={classes.editor}>
      <MemoizedTitleEditor
        pageId={pageId}
        slugId={slugId}
        title={title}
        spaceSlug={spaceSlug}
        editable={editable}
      />
      <MemoizedPageEditor pageId={pageId} editable={editable} />
    </div>
  );
}
