import { useEffect } from "react";
import { Container } from "@mantine/core";
import type { Editor } from "@tiptap/core";
import { PrimitiveAtom, useAtomValue, useSetAtom } from "jotai";
import { useSearchParams } from "react-router-dom";
import classes from "@/features/editor/styles/editor.module.css";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor";
import { PageByline } from "@/features/editor/full-editor";
import {
  pageEditorAtom,
  readOnlyEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import SearchAndReplaceDialog from "@/features/editor/components/search-and-replace/search-and-replace-dialog";
import SearchNavigationDialog from "@/features/editor/components/search-and-replace/search-navigation-dialog";
import { useSearchNavigationParams } from "@/features/editor/components/search-and-replace/use-search-navigation-params";
import { DeletedPageBanner } from "@/features/page/trash/components/deleted-page-banner";
import { IContributor } from "@/features/page/types/page.types";
import { userAtom } from "@/features/user/atoms/current-user-atom";

type ApprovedPageViewProps = {
  pageId: string;
  slugId: string;
  title: string;
  content: any;
  updatedAt: Date;
  creator?: { id: string; name: string; avatarUrl: string };
  contributors?: IContributor[];
};

// Readers of an approval-controlled page get its approved content without a collab connection.
export function ApprovedPageView({
  pageId,
  slugId,
  title,
  content,
  updatedAt,
  creator,
  contributors,
}: ApprovedPageViewProps) {
  const user = useAtomValue(userAtom);
  const fullPageWidth = user?.settings?.preferences?.fullPageWidth;
  const [searchParams] = useSearchParams();
  const readOnlyEditor = useAtomValue(readOnlyEditorAtom);
  // Declared without strict null checks, so jotai infers a read-only atom.
  const setPageEditor = useSetAtom(
    pageEditorAtom as PrimitiveAtom<Editor | null>,
  );

  const editor =
    readOnlyEditor && !readOnlyEditor.isDestroyed ? readOnlyEditor : null;

  // The table of contents, word count and copy actions read the page editor atom.
  useEffect(() => {
    if (!editor) return;
    setPageEditor(editor);
    return () =>
      setPageEditor((current) => (current === editor ? null : current));
  }, [editor, setPageEditor]);

  useSearchNavigationParams({
    editor,
    isSynced: true,
    pageId,
    searchParams,
    showStatic: false,
  });

  return (
    <Container
      fluid={fullPageWidth}
      size={!fullPageWidth && 900}
      className={classes.editor}
      style={{ display: "flex", flexDirection: "column" }}
    >
      <DeletedPageBanner slugId={slugId} />
      <ReadonlyPageEditor
        // A newly approved version replaces the content of an open page.
        key={`${pageId}:${String(updatedAt)}`}
        title={title}
        content={content}
        pageId={pageId}
        lightbox
        byline={
          <PageByline creator={creator} contributors={contributors} readOnly />
        }
      />
      {editor && <SearchAndReplaceDialog editor={editor} editable={false} />}
      {editor && <SearchNavigationDialog editor={editor} />}
    </Container>
  );
}
