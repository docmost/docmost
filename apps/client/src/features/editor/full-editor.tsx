import classes from "@/features/editor/styles/editor.module.css";
import React from "react";
import { TitleEditor } from "@/features/editor/title-editor";
import PageEditor from "@/features/editor/page-editor";
import { Container } from "@mantine/core";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import useUserRole from "@/hooks/use-user-role";
import { TableOfContentsOnPage } from "@/features/editor/components/table-of-contents/table-of-contents.tsx";

const MemoizedTitleEditor = React.memo(TitleEditor);
const MemoizedPageEditor = React.memo(PageEditor);

export interface FullEditorProps {
  pageId: string;
  slugId: string;
  title: string;
  content: string;
  spaceSlug: string;
  editable: boolean;
  canComment?: boolean;
}

export function FullEditor({
  pageId,
  title,
  slugId,
  content,
  spaceSlug,
  editable,
  canComment = false,
}: FullEditorProps) {
  const [user] = useAtom(userAtom);
  const { isVisitor } = useUserRole();
  const fullPageWidth = user.settings?.preferences?.fullPageWidth;

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
        editable={isVisitor ? false : editable}
      />
      <TableOfContentsOnPage />
      <MemoizedPageEditor
        pageId={pageId}
        editable={isVisitor ? false : editable}
        content={content}
        canComment={canComment}
      />
    </Container>
  );
}
