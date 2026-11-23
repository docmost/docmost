import { FC } from "react";
import { useAtomValue } from "jotai";
import type { Editor } from "@tiptap/react";
import { pageEditorBindingAtom } from "@/features/editor/atoms/editor-atoms";
import { useToolbarState } from "./use-toolbar-state";
import { BlockTypeGroup } from "./groups/block-type-group";
import { InlineMarksGroup } from "./groups/inline-marks-group";
import { ColorGroup } from "./groups/color-group";
import { ListsGroup } from "./groups/lists-group";
import { AlignmentGroup } from "./groups/alignment-group";
import { MediaGroup } from "./groups/media-group";
import { QuickInsertsGroup } from "./groups/quick-inserts-group";
import { MoreInsertsGroup } from "./groups/more-inserts-group";
import { HistoryGroup } from "./groups/history-group";
import classes from "./fixed-toolbar.module.css";
import editorClasses from "@/features/editor/styles/editor.module.css";

type FixedToolbarProps = {
  editor: Editor | null;
  templateMode?: boolean;
  withSpacer?: boolean;
};

export function PageFormattingToolbar({ pageId }: { pageId?: string }) {
  const binding = useAtomValue(pageEditorBindingAtom);
  const editor =
    binding?.editable && binding.pageId === pageId ? binding.editor : null;
  return <FixedToolbar editor={editor} withSpacer={false} />;
}

export const FixedToolbar: FC<FixedToolbarProps> = ({
  editor,
  templateMode = false,
  withSpacer = true,
}) => {
  return (
    <>
      <div
        className={classes.fixedToolbar}
        data-fixed-toolbar="true"
        role="toolbar"
        aria-label="Editor toolbar"
        aria-disabled={!editor || undefined}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className={classes.inner} inert={!editor}>
          {/* Close menus and bind selection and history to the new editor. */}
          <ToolbarControls
            key={editor?.instanceId ?? "pending"}
            editor={editor}
            templateMode={templateMode}
          />
        </div>
      </div>
      {withSpacer && (
        <div className={editorClasses.toolbarSpacer} aria-hidden />
      )}
    </>
  );
};

function ToolbarControls({
  editor,
  templateMode,
}: Omit<FixedToolbarProps, "withSpacer">) {
  const state = useToolbarState(editor);
  return (
    <>
      <BlockTypeGroup editor={editor} />
      <div className={classes.divider} />
      <InlineMarksGroup editor={editor} state={state} />
      <div className={classes.divider} />
      <ColorGroup editor={editor} />
      <div className={classes.divider} />
      <ListsGroup editor={editor} state={state} />
      <div className={classes.divider} />
      <AlignmentGroup editor={editor} />
      <div className={classes.divider} />
      <MediaGroup editor={editor} />
      <div className={classes.divider} />
      <QuickInsertsGroup editor={editor} />
      <MoreInsertsGroup editor={editor} templateMode={templateMode} />
      <div className={classes.divider} />
      <HistoryGroup editor={editor} state={state} />
    </>
  );
}
