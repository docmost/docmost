import React, { Dispatch, FC, SetStateAction } from "react";
import {
  IconAlignCenter,
  IconAlignJustified,
  IconAlignLeft,
  IconAlignRight,
  IconCheck,
  IconChevronDown,
} from "@tabler/icons-react";
import { Popover, Button, ScrollArea, rem } from "@mantine/core";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useTranslation } from "react-i18next";

interface TextAlignmentProps {
  editor: Editor | null;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

export interface BubbleMenuItem {
  name: string;
  icon: React.ElementType;
  command: () => void;
  isActive: () => boolean;
}

export const TextAlignmentSelector: FC<TextAlignmentProps> = ({
  editor,
  isOpen,
  setIsOpen,
}) => {
  const { t } = useTranslation();

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }

      return {
        isAlignLeft: ctx.editor.isActive({ textAlign: "left" }),
        isAlignCenter: ctx.editor.isActive({ textAlign: "center" }),
        isAlignRight: ctx.editor.isActive({ textAlign: "right" }),
        isAlignJustify: ctx.editor.isActive({ textAlign: "justify" }),
      };
    },
  });

  if (!editor || !editorState) {
    return null;
  }

  const items: BubbleMenuItem[] = [
    {
      name: "Align left",
      isActive: () => editorState?.isAlignLeft,
      command: () => editor.chain().focus().setTextAlign("left").run(),
      icon: IconAlignLeft,
    },
    {
      name: "Align center",
      isActive: () => editorState?.isAlignCenter,
      command: () => editor.chain().focus().setTextAlign("center").run(),
      icon: IconAlignCenter,
    },
    {
      name: "Align right",
      isActive: () => editorState?.isAlignRight,
      command: () => editor.chain().focus().setTextAlign("right").run(),
      icon: IconAlignRight,
    },
    {
      name: "Justify",
      isActive: () => editorState?.isAlignJustify,
      command: () => editor.chain().focus().setTextAlign("justify").run(),
      icon: IconAlignJustified,
    },
  ];

  const activeItem = items.filter((item) => item.isActive()).pop() ?? items[0];

  return (
    <Popover opened={isOpen} withArrow>
      <Popover.Target>
        <Button
          variant="default"
          style={{ border: "none", height: "34px" }}
          px="5"
          radius="0"
          rightSection={<IconChevronDown size={16} />}
          onClick={() => setIsOpen(!isOpen)}
        >
          <activeItem.icon style={{ width: rem(16) }} stroke={2} />
        </Button>
      </Popover.Target>

      <Popover.Dropdown>
        <ScrollArea.Autosize type="scroll" mah={400}>
          <Button.Group orientation="vertical">
            {items.map((item, index) => (
              <Button
                key={index}
                variant="default"
                leftSection={<item.icon size={16} />}
                rightSection={
                  activeItem.name === item.name && <IconCheck size={16} />
                }
                justify="left"
                fullWidth
                onClick={() => {
                  item.command();
                  setIsOpen(false);
                }}
                style={{ border: "none" }}
              >
                {t(item.name)}
              </Button>
            ))}
          </Button.Group>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
};
