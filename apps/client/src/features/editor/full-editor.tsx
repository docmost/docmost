import classes from "@/features/editor/styles/editor.module.css";
import React from "react";
import { TitleEditor } from "@/features/editor/title-editor";
import PageEditor from "@/features/editor/page-editor";
import { Container } from "@mantine/core";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useOs } from "@mantine/hooks";

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
  const [user] = useAtom(userAtom);
  const os = useOs();

  const fullPageWidth = user.settings?.preferences?.fullPageWidth;

  // intercept ctrl+s to prevent default browser save behavior
  document.addEventListener("keydown", function (e) {
    if (editable && os === 'macos' ? e.metaKey : e.ctrlKey && e.code.toLowerCase() === 'keys') {
      e.preventDefault();
    }
  }, false);

  return (
    <Container
      fluid={fullPageWidth}
      {... (fullPageWidth && { mx: 80 })}
      size={850}
      className={classes.editor}
    >
      <MemoizedTitleEditor
        pageId={pageId}
        slugId={slugId}
        title={title}
        spaceSlug={spaceSlug}
        editable={editable}
      />
      <MemoizedPageEditor pageId={pageId} editable={editable} />
    </Container>
  );
}
