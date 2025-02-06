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
import { useEditor } from "@tiptap/react";
import { useTranslation } from "react-i18next";

interface TextAlignmentProps {
  editor: ReturnType<typeof useEditor>;
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

  const items: BubbleMenuItem[] = [
    {
      name: "Align left",
      isActive: () => editor.isActive({ textAlign: "left" }),
      command: () => editor.chain().focus().setTextAlign("left").run(),
      icon: IconAlignLeft,
    },
    {
      name: "Align center",
      isActive: () => editor.isActive({ textAlign: "center" }),
      command: () => editor.chain().focus().setTextAlign("center").run(),
      icon: IconAlignCenter,
    },
    {
      name: "Align right",
      isActive: () => editor.isActive({ textAlign: "right" }),
      command: () => editor.chain().focus().setTextAlign("right").run(),
      icon: IconAlignRight,
    },
    {
      name: "Justify",
      isActive: () => editor.isActive({ textAlign: "justify" }),
      command: () => editor.chain().focus().setTextAlign("justify").run(),
      icon: IconAlignJustified,
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
          px="5"
          radius="0"
          rightSection={<IconChevronDown size={16} />}
          onClick={() => setIsOpen(!isOpen)}
        >
          <IconAlignLeft style={{ width: rem(16) }} stroke={2} />
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
