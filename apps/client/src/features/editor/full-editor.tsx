import PageEditor from "@/features/editor/page-editor";
import classes from "@/features/editor/styles/editor.module.css";
import { TitleEditor } from "@/features/editor/title-editor";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { Container } from "@mantine/core";
import { useAtom } from "jotai";
import React from "react";

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

  return (
    <Container
      fluid={fullPageWidth}
      size={!fullPageWidth && 850}
      className={classes.editor}
    >
      <MemoizedTitleEditor
        pageId={pageId}
        slugId={slugId}
        title={title}
        spaceSlug={spaceSlug}
        editable={editable}
      />
      <MemoizedPageEditor pageId={pageId} editable={editable} content={content} />
    </Container>
  );
}
