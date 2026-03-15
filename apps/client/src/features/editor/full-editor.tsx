import classes from "@/features/editor/styles/editor.module.css";
import React, { useEffect } from "react";
import { TitleEditor } from "@/features/editor/title-editor";
import PageEditor from "@/features/editor/page-editor";
import SourceEditor from "@/features/editor/source-editor";
import { Container } from "@mantine/core";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { sourceModeAtom } from "@/features/editor/atoms/editor-atoms";

const MemoizedTitleEditor = React.memo(TitleEditor);
const MemoizedPageEditor = React.memo(PageEditor);

export interface FullEditorProps {
  pageId: string;
  slugId: string;
  title: string;
  content: string;
  spaceSlug: string;
  editable: boolean;
}

export function FullEditor({
  pageId,
  title,
  slugId,
  content,
  spaceSlug,
  editable,
}: FullEditorProps) {
  const [user] = useAtom(userAtom);
  const fullPageWidth = user.settings?.preferences?.fullPageWidth;
  const [sourceMode, setSourceMode] = useAtom(sourceModeAtom);

  // Reset source mode when navigating to a different page
  useEffect(() => {
    setSourceMode(false);
  }, [pageId]);

  return (
    <Container
      fluid={fullPageWidth}
      size={!fullPageWidth && 900}
      className={classes.editor}
    >
      <MemoizedTitleEditor
        pageId={pageId}
        slugId={slugId}
        title={title}
        spaceSlug={spaceSlug}
        editable={editable}
      />

      {/* Keep PageEditor always mounted so its Tiptap/Y.js editor instance
          stays alive. Source mode hides it with CSS so that setContent()
          called on unmount of SourceEditor actually lands on a live editor. */}
      <div style={{ display: sourceMode ? "none" : undefined }}>
        <MemoizedPageEditor
          pageId={pageId}
          editable={editable}
          content={content}
        />
      </div>

      {sourceMode && <SourceEditor />}
    </Container>
  );
}
