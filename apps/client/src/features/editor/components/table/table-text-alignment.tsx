import React, { FC } from "react";
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconCheck,
} from "@tabler/icons-react";
import {
  ActionIcon,
  Button,
  Popover,
  ScrollArea,
  Tooltip,
} from "@mantine/core";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useTranslation } from "react-i18next";

interface TableTextAlignmentProps {
  editor: Editor | null;
}

interface AlignmentItem {
  name: string;
  icon: React.ElementType;
  command: () => void;
  isActive: () => boolean;
  value: string;
}

export const TableTextAlignment: FC<TableTextAlignmentProps> = ({ editor }) => {
  const { t } = useTranslation();
  const [opened, setOpened] = React.useState(false);

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
      };
    },
  });

  if (!editor || !editorState) {
    return null;
  }

  const items: AlignmentItem[] = [
    {
      name: "Align left",
      value: "left",
      isActive: () => editorState?.isAlignLeft,
      command: () => editor.chain().focus().setTextAlign("left").run(),
      icon: IconAlignLeft,
    },
    {
      name: "Align center",
      value: "center",
      isActive: () => editorState?.isAlignCenter,
      command: () => editor.chain().focus().setTextAlign("center").run(),
      icon: IconAlignCenter,
    },
    {
      name: "Align right",
      value: "right",
      isActive: () => editorState?.isAlignRight,
      command: () => editor.chain().focus().setTextAlign("right").run(),
      icon: IconAlignRight,
    },
  ];

  const activeItem = items.find((item) => item.isActive()) || items[0];

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom"
      withArrow
      transitionProps={{ transition: "pop" }}
    >
      <Popover.Target>
        <Tooltip label={t("Text alignment")} withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={t("Text alignment")}
            onClick={() => setOpened(!opened)}
          >
            <activeItem.icon size={18} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <ScrollArea.Autosize type="scroll" mah={300}>
          <Button.Group orientation="vertical">
            {items.map((item, index) => (
              <Button
                key={index}
                variant="default"
                leftSection={<item.icon size={16} />}
                rightSection={item.isActive() && <IconCheck size={16} />}
                justify="left"
                fullWidth
                onClick={() => {
                  item.command();
                  setOpened(false);
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
