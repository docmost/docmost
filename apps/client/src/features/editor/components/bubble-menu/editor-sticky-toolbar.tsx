import { FC, useState } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import {
  IconBold,
  IconCode,
  IconItalic,
  IconMessage,
  IconStrikethrough,
  IconUnderline,
} from "@tabler/icons-react";
import clsx from "clsx";
import { ActionIcon, rem, Tooltip } from "@mantine/core";
import { NodeSelector } from "@/features/editor/components/bubble-menu/node-selector.tsx";
import { TextAlignmentSelector } from "@/features/editor/components/bubble-menu/text-alignment-selector.tsx";
import { LinkSelector } from "@/features/editor/components/bubble-menu/link-selector.tsx";
import { ColorSelector } from "@/features/editor/components/bubble-menu/color-selector.tsx";
import {
  draftCommentIdAtom,
  showCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import { useAtom } from "jotai";
import { v7 as uuid7 } from "uuid";
import { useTranslation } from "react-i18next";
import classes from "./editor-sticky-toolbar.module.css";

interface EditorStickyToolbarProps {
  editor: Editor | null;
}

type ToolbarItem = {
  name: string;
  isActive: () => boolean;
  command: () => void;
  icon: typeof IconBold;
};

export const EditorStickyToolbar: FC<EditorStickyToolbarProps> = ({ editor }) => {
  const { t } = useTranslation();
  const [, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const [, setDraftCommentId] = useAtom(draftCommentIdAtom);
  const [isNodeSelectorOpen, setIsNodeSelectorOpen] = useState(false);
  const [isTextAlignmentSelectorOpen, setIsTextAlignmentOpen] = useState(false);
  const [isLinkSelectorOpen, setIsLinkSelectorOpen] = useState(false);
  const [isColorSelectorOpen, setIsColorSelectorOpen] = useState(false);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }
      return {
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isUnderline: ctx.editor.isActive("underline"),
        isStrike: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
      };
    },
  });

  if (!editor || !editorState) {
    return null;
  }

  const items: ToolbarItem[] = [
    {
      name: "Bold",
      isActive: () => editorState?.isBold,
      command: () => editor.chain().focus().toggleBold().run(),
      icon: IconBold,
    },
    {
      name: "Italic",
      isActive: () => editorState?.isItalic,
      command: () => editor.chain().focus().toggleItalic().run(),
      icon: IconItalic,
    },
    {
      name: "Underline",
      isActive: () => editorState?.isUnderline,
      command: () => editor.chain().focus().toggleUnderline().run(),
      icon: IconUnderline,
    },
    {
      name: "Strike",
      isActive: () => editorState?.isStrike,
      command: () => editor.chain().focus().toggleStrike().run(),
      icon: IconStrikethrough,
    },
    {
      name: "Code",
      isActive: () => editorState?.isCode,
      command: () => editor.chain().focus().toggleCode().run(),
      icon: IconCode,
    },
  ];

  return (
    <div className={classes.stickyToolbar}>
      <div className={classes.toolbarInner}>
        <NodeSelector
          editor={editor}
          isOpen={isNodeSelectorOpen}
          setIsOpen={() => {
            setIsNodeSelectorOpen(!isNodeSelectorOpen);
            setIsTextAlignmentOpen(false);
            setIsLinkSelectorOpen(false);
            setIsColorSelectorOpen(false);
          }}
        />

        <TextAlignmentSelector
          editor={editor}
          isOpen={isTextAlignmentSelectorOpen}
          setIsOpen={() => {
            setIsTextAlignmentOpen(!isTextAlignmentSelectorOpen);
            setIsNodeSelectorOpen(false);
            setIsLinkSelectorOpen(false);
            setIsColorSelectorOpen(false);
          }}
        />

        <ActionIcon.Group>
          {items.map((item) => (
            <Tooltip key={item.name} label={t(item.name)} withArrow>
              <ActionIcon
                variant="subtle"
                size="lg"
                radius="0"
                aria-label={t(item.name)}
                className={clsx({ [classes.active]: item.isActive() })}
                onClick={item.command}
              >
                <item.icon style={{ width: rem(16) }} stroke={1.75} />
              </ActionIcon>
            </Tooltip>
          ))}
        </ActionIcon.Group>

        <LinkSelector
          editor={editor}
          isOpen={isLinkSelectorOpen}
          setIsOpen={(value) => {
            setIsLinkSelectorOpen(value);
            setIsNodeSelectorOpen(false);
            setIsTextAlignmentOpen(false);
            setIsColorSelectorOpen(false);
          }}
        />

        <ColorSelector
          editor={editor}
          isOpen={isColorSelectorOpen}
          setIsOpen={() => {
            setIsColorSelectorOpen(!isColorSelectorOpen);
            setIsNodeSelectorOpen(false);
            setIsTextAlignmentOpen(false);
            setIsLinkSelectorOpen(false);
          }}
        />

        <Tooltip label={t("Comment")} withArrow>
          <ActionIcon
            variant="subtle"
            size="lg"
            radius="0"
            aria-label={t("Comment")}
            onClick={() => {
              const commentId = uuid7();
              editor.chain().focus().setCommentDecoration().run();
              setDraftCommentId(commentId);
              setShowCommentPopup(true);
            }}
          >
            <IconMessage size={16} stroke={1.75} />
          </ActionIcon>
        </Tooltip>
      </div>
    </div>
  );
};
