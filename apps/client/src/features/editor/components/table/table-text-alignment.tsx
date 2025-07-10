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
  rem,
  ScrollArea,
  Tooltip,
} from "@mantine/core";
import { useEditor } from "@tiptap/react";
import { useTranslation } from "react-i18next";

interface TableTextAlignmentProps {
  editor: ReturnType<typeof useEditor>;
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

  const items: AlignmentItem[] = [
    {
      name: "Align left",
      value: "left",
      isActive: () => editor.isActive({ textAlign: "left" }),
      command: () => editor.chain().focus().setTextAlign("left").run(),
      icon: IconAlignLeft,
    },
    {
      name: "Align center",
      value: "center",
      isActive: () => editor.isActive({ textAlign: "center" }),
      command: () => editor.chain().focus().setTextAlign("center").run(),
      icon: IconAlignCenter,
    },
    {
      name: "Align right",
      value: "right",
      isActive: () => editor.isActive({ textAlign: "right" }),
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
      transitionProps={{ transition: 'pop' }}
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
                rightSection={
                  item.isActive() && <IconCheck size={16} />
                }
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