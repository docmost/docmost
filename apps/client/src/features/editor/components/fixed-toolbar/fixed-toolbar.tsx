import { FC } from "react";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { useToolbarState } from "./use-toolbar-state";
import { BlockTypeGroup } from "./groups/block-type-group";
import { InlineMarksGroup } from "./groups/inline-marks-group";
import { ColorGroup } from "./groups/color-group";
import { ListsGroup } from "./groups/lists-group";
import { LinkGroup } from "./groups/link-group";
import { AlignmentGroup } from "./groups/alignment-group";
import { MediaGroup } from "./groups/media-group";
import { QuickInsertsGroup } from "./groups/quick-inserts-group";
import { MoreInsertsGroup } from "./groups/more-inserts-group";
import { HistoryGroup } from "./groups/history-group";
import { AskAiGroup } from "./groups/ask-ai-group";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import classes from "./fixed-toolbar.module.css";

export const FixedToolbar: FC = () => {
  const editor = useAtomValue(pageEditorAtom);
  const state = useToolbarState(editor);
  const workspace = useAtomValue(workspaceAtom);
  const isGenerativeAiEnabled = workspace?.settings?.ai?.generative === true;

  if (!editor || !state) return null;

  return (
    <>
      <div
        className={classes.fixedToolbar}
        role="toolbar"
        aria-label="Editor toolbar"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className={classes.inner}>
          {/* {isGenerativeAiEnabled && (
            <>
              <AskAiGroup />
              <div className={classes.divider} />
            </>
          )} */}
          <BlockTypeGroup editor={editor} />
          <div className={classes.divider} />
          <InlineMarksGroup editor={editor} state={state} />
          <div className={classes.divider} />
          <ColorGroup editor={editor} />
          <div className={classes.divider} />
          <ListsGroup editor={editor} state={state} />
          <div className={classes.divider} />
          <LinkGroup />
          <div className={classes.divider} />
          <AlignmentGroup editor={editor} />
          <div className={classes.divider} />
          <MediaGroup editor={editor} />
          <div className={classes.divider} />
          <QuickInsertsGroup editor={editor} />
          <MoreInsertsGroup editor={editor} />
          <div className={classes.divider} />
          <HistoryGroup editor={editor} state={state} />
        </div>
      </div>
      <div className={classes.spacer} aria-hidden />
    </>
  );
};
