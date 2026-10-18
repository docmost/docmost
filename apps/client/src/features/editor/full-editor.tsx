import classes from "@/features/editor/styles/editor.module.css";
import React, { useEffect } from "react";
import { TitleEditor } from "@/features/editor/title-editor";
import PageEditor from "@/features/editor/page-editor";
import { Container } from "@mantine/core";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { ApprovalBanner } from "@/ee/page-verification";
import { IContributor } from "@/features/page/types/page.types.ts";
import { FixedToolbar } from "@/features/editor/components/fixed-toolbar/fixed-toolbar";
import {
  PageByline,
  type PageUser,
} from "@/features/editor/components/page-byline";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { DeletedPageBanner } from "@/features/page/trash/components/deleted-page-banner.tsx";
import { currentPageEditModeAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { EmptyPageGetStarted } from "@/features/editor/components/empty-page/empty-page-get-started";

const MemoizedTitleEditor = React.memo(TitleEditor);
const MemoizedPageEditor = React.memo(PageEditor);
const MemoizedFixedToolbar = React.memo(FixedToolbar);
const MemoizedDeletedPageBanner = React.memo(DeletedPageBanner);
const MemoizedApprovalBanner = React.memo(ApprovalBanner);

// Module-level flag: survives component unmount/remount on page navigation,
// reset only on full page reload (i.e. a new app session).
let defaultEditModeApplied = false;

export interface FullEditorProps {
  pageId: string;
  slugId: string;
  title: string;
  content: string;
  spaceId: string;
  spaceSlug: string;
  editable: boolean;
  creator?: PageUser;
  contributors?: IContributor[];
  canComment?: boolean;
}

export function FullEditor({
  pageId,
  title,
  slugId,
  content,
  spaceId,
  spaceSlug,
  editable,
  creator,
  contributors,
  canComment,
}: FullEditorProps) {
  const [user] = useAtom(userAtom);
  const fullPageWidth = user?.settings?.preferences?.fullPageWidth;
  const editorToolbarEnabled =
    user?.settings?.preferences?.editorToolbar ?? false;
  const [currentPageEditMode, setCurrentPageEditMode] = useAtom(
    currentPageEditModeAtom,
  );
  const userPageEditMode =
    user?.settings?.preferences?.pageEditMode ?? PageEditMode.Edit;
  const isEditMode = currentPageEditMode === PageEditMode.Edit;

  // Apply the user's saved preference only once on initial load, not on every
  // page navigation — so the mode sticks across navigations within a session.
  useEffect(() => {
    if (user && !defaultEditModeApplied) {
      setCurrentPageEditMode(userPageEditMode as PageEditMode);
      defaultEditModeApplied = true;
    }
  }, [user, userPageEditMode, setCurrentPageEditMode]);

  return (
    <Container
      fluid={fullPageWidth}
      size={!fullPageWidth && 900}
      className={classes.editor}
      style={{ display: "flex", flexDirection: "column" }}
    >
      {editorToolbarEnabled && editable && isEditMode && (
        <MemoizedFixedToolbar />
      )}
      <MemoizedDeletedPageBanner slugId={slugId} />
      <MemoizedApprovalBanner slugId={slugId} />
      <MemoizedTitleEditor
        pageId={pageId}
        slugId={slugId}
        title={title}
        spaceSlug={spaceSlug}
        editable={editable}
      />
      <PageByline
        creator={creator}
        contributors={contributors}
        readOnly={!editable}
      />
      <MemoizedPageEditor
        pageId={pageId}
        editable={editable}
        content={content}
        canComment={canComment}
      />
      <EmptyPageGetStarted
        pageId={pageId}
        spaceId={spaceId}
        editable={editable}
      />
    </Container>
  );
}
