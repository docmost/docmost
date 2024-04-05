import { Dispatch, FC, SetStateAction } from "react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { Button, Popover, rem, ScrollArea, Text } from "@mantine/core";
import classes from "./bubble-menu.module.css";
import { useEditor } from "@tiptap/react";

export interface BubbleColorMenuItem {
  name: string;
  color: string;
}

interface ColorSelectorProps {
  editor: ReturnType<typeof useEditor>;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const TEXT_COLORS: BubbleColorMenuItem[] = [
  {
    name: "Default",
    color: "",
  },
  {
    name: "Blue",
    color: "#2563EB",
  },
  {
    name: "Green",
    color: "#008A00",
  },
  {
    name: "Purple",
    color: "#9333EA",
  },
  {
    name: "Red",
    color: "#E00000",
  },
  {
    name: "Yellow",
    color: "#EAB308",
  },
  {
    name: "Orange",
    color: "#FFA500",
  },
  {
    name: "Pink",
    color: "#BA4081",
  },
  {
    name: "Gray",
    color: "#A8A29E",
  },
];

// TODO: handle dark mode
const HIGHLIGHT_COLORS: BubbleColorMenuItem[] = [
  {
    name: "Default",
    color: "",
  },
  {
    name: "Blue",
    color: "#c1ecf9",
  },
  {
    name: "Green",
    color: "#acf79f",
  },
  {
    name: "Purple",
    color: "#f6f3f8",
  },
  {
    name: "Red",
    color: "#fdebeb",
  },
  {
    name: "Yellow",
    color: "#fbf4a2",
  },
  {
    name: "Orange",
    color: "#faebdd",
  },
  {
    name: "Pink",
    color: "#faf1f5",
  },
  {
    name: "Gray",
    color: "#f1f1ef",
  },
];

export const ColorSelector: FC<ColorSelectorProps> = ({
  editor,
  isOpen,
  setIsOpen,
}) => {
  const activeColorItem = TEXT_COLORS.find(({ color }) =>
    editor.isActive("textStyle", { color }),
  );

  const activeHighlightItem = HIGHLIGHT_COLORS.find(({ color }) =>
    editor.isActive("highlight", { color }),
  );

  return (
    <Popover width={200} opened={isOpen} withArrow>
      <Popover.Target>
        <Button
          variant="default"
          radius="0"
          leftSection="A"
          rightSection={<IconChevronDown size={16} />}
          className={classes.colorButton}
          style={{
            color: activeColorItem?.color,
          }}
          onClick={() => setIsOpen(!isOpen)}
        />
      </Popover.Target>

      <Popover.Dropdown>
        {/* make mah responsive */}
        <ScrollArea.Autosize type="scroll" mah="400">
          <Text span c="dimmed" inherit>
            COLOR
          </Text>

          <Button.Group orientation="vertical">
            {TEXT_COLORS.map(({ name, color }, index) => (
              <Button
                key={index}
                variant="default"
                leftSection={<span style={{ color }}>A</span>}
                justify="left"
                fullWidth
                rightSection={
                  editor.isActive("textStyle", { color }) && (
                    <IconCheck style={{ width: rem(16) }} />
                  )
                }
                onClick={() => {
                  editor.commands.unsetColor();
                  name !== "Default" &&
                    editor
                      .chain()
                      .focus()
                      .setColor(color || "")
                      .run();
                  setIsOpen(false);
                }}
                style={{ border: "none" }}
              >
                {name}
              </Button>
            ))}
          </Button.Group>

          <Text span c="dimmed" inherit>
            BACKGROUND
          </Text>

          <Button.Group orientation="vertical">
            {HIGHLIGHT_COLORS.map(({ name, color }, index) => (
              <Button
                key={index}
                variant="default"
                leftSection={
                  <span style={{ padding: "4px", background: color }}>A</span>
                }
                justify="left"
                fullWidth
                rightSection={
                  editor.isActive("highlight", { color }) && (
                    <IconCheck style={{ width: rem(16) }} />
                  )
                }
                onClick={() => {
                  editor.commands.unsetHighlight();
                  name !== "Default" && editor.commands.setHighlight({ color });
                  setIsOpen(false);
                }}
                style={{ border: "none" }}
              >
                {name}
              </Button>
            ))}
          </Button.Group>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
};
