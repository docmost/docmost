import {
  BubbleMenu,
  isNodeSelection,
  isTextSelection,
  useEditor,
} from "@tiptap/react";
import { FC, useEffect, useRef } from "react";
import { IconMessage } from "@tabler/icons-react";
import classes from "./bubble-menu.module.css";
import { ActionIcon, Tooltip } from "@mantine/core";
import {
  readOnlyCommentDataAtom,
  showReadOnlyCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import { useAtom } from "jotai";
import { isCellSelection } from "@docmost/editor-ext";
import { useTranslation } from "react-i18next";
import { ySyncPluginKey } from "y-prosemirror";
import { getRelativeSelection } from "y-prosemirror";

type ReadOnlyBubbleMenuProps = {
  editor: ReturnType<typeof useEditor>;
};

export const ReadOnlyBubbleMenu: FC<ReadOnlyBubbleMenuProps> = ({ editor }) => {
  const { t } = useTranslation();
  const [showReadOnlyCommentPopup, setShowReadOnlyCommentPopup] = useAtom(
    showReadOnlyCommentPopupAtom,
  );
  const [, setReadOnlyCommentData] = useAtom(readOnlyCommentDataAtom);
  const showPopupRef = useRef(showReadOnlyCommentPopup);

  useEffect(() => {
    showPopupRef.current = showReadOnlyCommentPopup;
  }, [showReadOnlyCommentPopup]);

  const handleCommentClick = () => {
    if (!editor) return;

    const view = editor.view;
    const ystate = ySyncPluginKey.getState(view.state);

    if (ystate?.binding) {
      const selection = getRelativeSelection(ystate.binding, view.state);
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to);

      // @ts-ignore
      setReadOnlyCommentData({
        yjsSelection: {
          anchor: selection.anchor,
          head: selection.head,
        },
        selectedText,
      });
      setShowReadOnlyCommentPopup(true);
    }
  };

  // Don't render if editor is not available or is editable
  if (!editor || editor.isEditable) return null;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="readonly"
      shouldShow={({ state, editor }) => {
        // Safety check - don't show if editor became editable
        if (!editor || editor.isEditable || editor.isDestroyed) {
          return false;
        }

        const { selection } = state;
        const { empty, from, to } = selection;

        if (
          editor.isActive("image") ||
          empty ||
          isNodeSelection(selection) ||
          isCellSelection(selection) ||
          showPopupRef?.current
        ) {
          return false;
        }

        // Check if actual text is selected (not just empty block)
        const hasText = state.doc.textBetween(from, to).length > 0;
        return isTextSelection(selection) && hasText;
      }}
      tippyOptions={{
        moveTransition: "transform 0.15s ease-out",
      }}
    >
      <div className={classes.bubbleMenu}>
        <Tooltip label={t("Comment")} withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="0"
            aria-label={t("Comment")}
            style={{ border: "none" }}
            onClick={handleCommentClick}
          >
            <IconMessage size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>
      </div>
    </BubbleMenu>
  );
};
