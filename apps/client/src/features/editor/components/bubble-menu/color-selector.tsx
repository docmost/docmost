import { Dispatch, FC, SetStateAction } from "react";
import { IconCheck, IconPalette } from "@tabler/icons-react";
import {
  ActionIcon,
  Button,
  Popover,
  rem,
  ScrollArea,
  Text,
  Tooltip,
} from "@mantine/core";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useTranslation } from "react-i18next";

export interface BubbleColorMenuItem {
  name: string;
  color: string;
}

interface ColorSelectorProps {
  editor: Editor | null;
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

export const ColorSelector: FC<ColorSelectorProps> = ({
  editor,
  isOpen,
  setIsOpen,
}) => {
  const { t } = useTranslation();

  const editorState = useEditorState({
    editor,
    selector: ctx => {
      if (!ctx.editor) {
        return null;
      }

      const activeColors: Record<string, boolean> = {};
      TEXT_COLORS.forEach(({ color }) => {
        activeColors[`text_${color}`] = ctx.editor.isActive("textStyle", { color });
      });
      HIGHLIGHT_COLORS.forEach(({ color }) => {
        activeColors[`highlight_${color}`] = ctx.editor.isActive("highlight", { color });
      });

      return activeColors;
    },
  });

  if (!editor || !editorState) {
    return null;
  }

  const activeColorItem = TEXT_COLORS.find(({ color }) =>
    editorState[`text_${color}`]
  );

  const activeHighlightItem = HIGHLIGHT_COLORS.find(({ color }) =>
    editorState[`highlight_${color}`]
  );

  return (
    <Popover width={220} opened={isOpen} withArrow>
      <Popover.Target>
        <Tooltip label={t("Text color")} withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="0"
            style={{
              border: "none",
              color: activeColorItem?.color,
              backgroundColor: activeHighlightItem?.color,
            }}
            onClick={() => setIsOpen(!isOpen)}
          >
            <IconPalette size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        {/* make mah responsive */}
        <ScrollArea.Autosize type="scroll" mah="400">
          <Text span c="dimmed" tt="uppercase" inherit>
            {t("Color")}
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
                  editorState[`text_${color}`] && (
                    <IconCheck style={{ width: rem(16) }} />
                  )
                }
                onClick={() => {
                  if (name === "Default") {
                    editor.commands.unsetColor();
                  } else {
                    editor.chain().focus().setColor(color || "").run();
                  }
                  setIsOpen(false);
                }}
                style={{ border: "none" }}
              >
                {t(name)}
              </Button>
            ))}
          </Button.Group>

          <Text size="xs" span c="dimmed" tt="uppercase" inherit>
            {t("Background color")}
          </Text>

          <Button.Group orientation="vertical">
            {HIGHLIGHT_COLORS.map(({ name, color }, index) => (
              <Button
                key={index}
                variant="default"
                leftSection={
                  <span
                    style={{
                      backgroundColor: color,
                      paddingInline: rem(4),
                      paddingBlock: rem(2),
                    }}
                  >
                    A
                  </span>
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
