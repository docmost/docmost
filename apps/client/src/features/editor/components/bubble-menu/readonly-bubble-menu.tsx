import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { IconMessage } from "@tabler/icons-react";
import classes from "./bubble-menu.module.css";
import { ActionIcon, Tooltip } from "@mantine/core";
import { useAtom } from "jotai";
import {
  showReadOnlyCommentPopupAtom,
  readOnlyCommentDataAtom,
} from "@/features/comment/atoms/comment-atom";
import { useTranslation } from "react-i18next";
import { getRelativeSelection, ySyncPluginKey } from "@tiptap/y-tiptap";

type ReadonlyBubbleMenuProps = {
  editor: Editor;
};

export const ReadonlyBubbleMenu: FC<ReadonlyBubbleMenuProps> = ({ editor }) => {
  const { t } = useTranslation();
  const [showReadOnlyCommentPopup, setShowReadOnlyCommentPopup] = useAtom(
    showReadOnlyCommentPopupAtom,
  );
  const [, setReadOnlyCommentData] = useAtom(readOnlyCommentDataAtom);
  const menuRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const isInteractingRef = useRef(false);

  const updateMenuPosition = useCallback(() => {
    if (isInteractingRef.current) return;

    const pmSelection = editor.state.selection;
    if (!(pmSelection instanceof TextSelection) || pmSelection.empty) {
      setVisible(false);
      return;
    }

    const selection = window.getSelection();
    if (
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0 ||
      showReadOnlyCommentPopup
    ) {
      setVisible(false);
      return;
    }

    const editorDom = editor.view.dom;
    if (
      !editorDom.contains(selection.anchorNode) ||
      !editorDom.contains(selection.focusNode)
    ) {
      setVisible(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0) {
      setVisible(false);
      return;
    }

    const editorRect = editorDom
      .closest(".editor-container")
      ?.getBoundingClientRect();
    if (!editorRect) {
      setVisible(false);
      return;
    }

    setPosition({
      top: rect.top - editorRect.top - 44,
      left: rect.left - editorRect.left + rect.width / 2,
    });
    setVisible(true);
  }, [editor, showReadOnlyCommentPopup]);

  useEffect(() => {
    const handleSelectionChange = () => {
      updateMenuPosition();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [updateMenuPosition]);

  useEffect(() => {
    if (showReadOnlyCommentPopup) {
      setVisible(false);
    }
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
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        transform: "translateX(-50%)",
        zIndex: 199,
      }}
    >
      <div className={classes.bubbleMenu}>
        <Tooltip label={t("Comment")} withArrow withinPortal={false}>
          <ActionIcon
            variant="default"
            size="lg"
            radius="6px"
            aria-label={t("Comment")}
            style={{ border: "none" }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              isInteractingRef.current = true;
              handleCommentClick();
              isInteractingRef.current = false;
            }}
          >
            <IconMessage size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>
      </div>
    </div>
  );
};
