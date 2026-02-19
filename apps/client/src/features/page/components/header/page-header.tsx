import classes from "./page-header.module.css";
import PageHeaderMenu from "@/features/page/components/header/page-header-menu.tsx";
import { Group } from "@mantine/core";
import Breadcrumb from "@/features/page/components/breadcrumbs/breadcrumb.tsx";
import { EditorStickyToolbar } from "@/features/editor/components/bubble-menu/editor-sticky-toolbar.tsx";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { useEditorState } from "@tiptap/react";
import { useLocation } from "react-router-dom";

interface Props {
  readOnly?: boolean;
}
export default function PageHeader({ readOnly }: Props) {
  const location = useLocation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const editorIsEditable = useEditorState({
    editor: pageEditor,
    selector: (ctx) => ctx.editor?.isEditable ?? false,
  });
  const isPageRoute = location.pathname.includes("/p/");
  const showToolbar =
    Boolean(pageEditor) &&
    !pageEditor?.isDestroyed &&
    Boolean(editorIsEditable) &&
    !readOnly &&
    isPageRoute;

  return (
    <div className={classes.header}>
      <Group className={classes.left} wrap="nowrap">
        <Breadcrumb />

        {showToolbar && (
          <>
            <span className={classes.divider} aria-hidden="true" />
            <div className={classes.toolbarSlot}>
              <EditorStickyToolbar editor={pageEditor} />
            </div>
          </>
        )}
      </Group>

      <Group
        justify="flex-end"
        h="100%"
        wrap="nowrap"
        gap="var(--mantine-spacing-xs)"
        className={classes.right}
      >
        <PageHeaderMenu readOnly={readOnly} />
      </Group>
    </div>
  );
}
