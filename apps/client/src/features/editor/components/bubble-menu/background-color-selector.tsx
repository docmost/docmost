import {
  ActionIcon,
  Button,
  Popover,
  rem,
  ScrollArea,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconPaint } from "@tabler/icons-react";
import { useEditor } from "@tiptap/react";
import { Dispatch, FC, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

export interface BubbleColorMenuItem {
  name: string;
  color: string;
}

interface ColorSelectorProps {
  editor: ReturnType<typeof useEditor>;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const PASTEL_BACKGROUND_TEXT_COLORS: BubbleColorMenuItem[] = [
  {
    name: "Default",
    color: "",
  },
  {
    name: "Blue",
    color: "#A3BFFA",
  },
  {
    name: "Green",
    color: "#A8E6A2",
  },
  {
    name: "Purple",
    color: "#D3B8F6",
  },
  {
    name: "Red",
    color: "#F4A1A1",
  },
  {
    name: "Yellow",
    color: "#FAF3A3",
  },
  {
    name: "Orange",
    color: "#FFD8A8",
  },
  {
    name: "Pink",
    color: "#F7B6D2",
  },
  {
    name: "Gray",
    color: "#D4D4D4",
  },
];


export const BackgroundColorSelector: FC<ColorSelectorProps> = ({
  editor,
  isOpen,
  setIsOpen,
}) => {
  const { t } = useTranslation();
  const activeColorItem = PASTEL_BACKGROUND_TEXT_COLORS.find(({ color }) =>
    editor.isActive("highlight", { color }),
  );

  return (
    <Popover width={250} opened={isOpen} withArrow>
      <Popover.Target>
        <Tooltip label={t("Background color")} withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="0"
            style={{
              border: "none",
              color: activeColorItem?.color,
            }}
            onClick={() => setIsOpen(!isOpen)}
          >
            <IconPaint size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <ScrollArea.Autosize type="scroll" mah="400">
          <Text size="xs" span c="dimmed" tt="uppercase" inherit>
            {t("Background color")}
          </Text>

          <Button.Group orientation="vertical">
            {PASTEL_BACKGROUND_TEXT_COLORS.map(({ name, color }, index) => (
              <Button
                key={index}
                variant="default"
                leftSection={(
                  <span
                    style={{
                      backgroundColor: color,
                      paddingInline: rem(4),
                      paddingBlock: rem(2)
                    }}
                  >
                    A
                  </span>
                )}
                justify="left"
                fullWidth
                rightSection={
                  editor.isActive("textStyle", { color }) && (
                    <IconCheck style={{ width: rem(16) }} />
                  )
                }
                onClick={() => {
                  editor.commands.unsetHighlight();
                  name !== "Default" &&
                    editor
                      .chain()
                      .focus()
                      .toggleHighlight({ color: color || "" })
                      .run();
                  setIsOpen(false);
                }}
                style={{ border: "none" }}
              >
                {t(name)}
              </Button>
            ))}
          </Button.Group>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
};
