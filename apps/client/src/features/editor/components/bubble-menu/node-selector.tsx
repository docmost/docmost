import React, { Dispatch, FC, SetStateAction } from "react";
import {
  IconBlockquote,
  IconCheck,
  IconCheckbox,
  IconChevronDown,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconTypography,
} from "@tabler/icons-react";
import { Popover, Button, ScrollArea } from "@mantine/core";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useTranslation } from "react-i18next";

interface NodeSelectorProps {
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

export const NodeSelector: FC<NodeSelectorProps> = ({
  editor,
  isOpen,
  setIsOpen,
}) => {
  const { t } = useTranslation();

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!editor) {
        return null;
      }

      return {
        isParagraph: ctx.editor.isActive("paragraph"),
        isBulletList: ctx.editor.isActive("bulletList"),
        isOrderedList: ctx.editor.isActive("orderedList"),
        isHeading1: ctx.editor.isActive("heading", { level: 1 }),
        isHeading2: ctx.editor.isActive("heading", { level: 2 }),
        isHeading3: ctx.editor.isActive("heading", { level: 3 }),
        isTaskItem: ctx.editor.isActive("taskItem"),
        isBlockquote: ctx.editor.isActive("blockquote"),
        isCodeBlock: ctx.editor.isActive("codeBlock"),
      };
    },
  });

  const items: BubbleMenuItem[] = [
    {
      name: "Text",
      icon: IconTypography,
      command: () =>
        editor.chain().focus().toggleNode("paragraph", "paragraph").run(),
      isActive: () =>
        editorState?.isParagraph &&
        !editorState?.isBulletList &&
        !editorState?.isOrderedList,
    },
    {
      name: "Heading 1",
      icon: IconH1,
      command: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editorState?.isHeading1,
    },
    {
      name: "Heading 2",
      icon: IconH2,
      command: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editorState?.isHeading2,
    },
    {
      name: "Heading 3",
      icon: IconH3,
      command: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => editorState?.isHeading3,
    },
    {
      name: "To-do List",
      icon: IconCheckbox,
      command: () => editor.chain().focus().toggleTaskList().run(),
      isActive: () => editorState?.isTaskItem,
    },
    {
      name: "Bullet List",
      icon: IconList,
      command: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editorState?.isBulletList,
    },
    {
      name: "Numbered List",
      icon: IconListNumbers,
      command: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editorState?.isOrderedList,
    },
    {
      name: "Blockquote",
      icon: IconBlockquote,
      command: () =>
        editor
          .chain()
          .focus()
          .toggleNode("paragraph", "paragraph")
          .toggleBlockquote()
          .run(),
      isActive: () => editorState?.isBlockquote,
    },
    {
      name: "Code",
      icon: IconCode,
      command: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: () => editorState?.isCodeBlock,
    },
  ];

  const activeItem = items.filter((item) => item.isActive()).pop() ?? {
    name: "Multiple",
  };

  return (
    <Popover opened={isOpen} withArrow>
      <Popover.Target>
        <Button
          variant="default"
          style={{ border: "none", height: "34px" }}
          radius="0"
          rightSection={<IconChevronDown size={16} />}
          onClick={() => setIsOpen(!isOpen)}
        >
          {t(activeItem?.name)}
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
