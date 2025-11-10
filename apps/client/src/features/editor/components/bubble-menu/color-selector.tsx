import { Dispatch, FC, SetStateAction } from "react";
import { IconCheck, IconPalette, IconHighlight } from "@tabler/icons-react";
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
import {
  HIGHLIGHT_VARIANTS,
  HIGHLIGHT_VARIANTS_WITH_VALUE,
} from "@/features/editor/extensions/highlight-variants";

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

const DEFAULT_HIGHLIGHT_KEY = "highlight_default";

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
      return activeColors;
    },
  });

  if (!editor || !editorState) {
    return null;
  }

  const activeColorItem = TEXT_COLORS.find(({ color }) =>
    editorState[`text_${color}`]
  );

  return (
    <Popover width={200} opened={isOpen} withArrow>
      <Popover.Target>
        <Tooltip label={t("Text color")} withArrow>
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
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
};

export const HighlightSelector: FC<ColorSelectorProps> = ({
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
      activeColors[DEFAULT_HIGHLIGHT_KEY] = !ctx.editor.isActive("highlight");
      HIGHLIGHT_VARIANTS_WITH_VALUE.forEach(({ variant }) => {
        activeColors[`highlight_${variant}`] = ctx.editor.isActive("highlight", {
          variant,
        });
      });

      return activeColors;
    },
  });

  if (!editor || !editorState) {
    return null;
  }

  const activeHighlightItem = HIGHLIGHT_VARIANTS_WITH_VALUE.find(({ variant }) =>
    editorState[`highlight_${variant}`]
  );

  return (
    <Popover width={200} opened={isOpen} withArrow>
      <Popover.Target>
        <Tooltip label={t("Highlight color")} withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="0"
            style={{
              border: "none",
              backgroundColor: activeHighlightItem?.swatchColor,
            }}
            onClick={() => setIsOpen(!isOpen)}
          >
            <IconHighlight size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <ScrollArea.Autosize type="scroll" mah="400">
          <Text span c="dimmed" tt="uppercase" inherit>
            {t("Highlight")}
          </Text>

          <Button.Group orientation="vertical">
            {HIGHLIGHT_VARIANTS.map(({ name, variant, swatchColor }, index) => (
              <Button
                key={index}
                variant="default"
                leftSection={
                  <span
                    style={{
                      display: "inline-block",
                      backgroundColor: swatchColor || "transparent",
                      width: rem(16),
                      height: rem(16),
                      borderRadius: rem(2),
                    }}
                  />
                }
                justify="left"
                fullWidth
                rightSection={
                  (variant
                    ? editorState[`highlight_${variant}`]
                    : editorState[DEFAULT_HIGHLIGHT_KEY]) && (
                    <IconCheck style={{ width: rem(16) }} />
                  )
                }
                onClick={() => {
                  if (!variant) {
                    editor.commands.unsetHighlight();
                  } else {
                    editor.chain().focus().setHighlight({ variant }).run();
                  }
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
