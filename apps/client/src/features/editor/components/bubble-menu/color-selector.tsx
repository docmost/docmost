import React, { Dispatch, FC, SetStateAction } from "react";
import { IconCheck, IconChevronDown, IconPalette } from "@tabler/icons-react";
import {
  ActionIcon,
  Button,
  Popover,
  rem,
  ScrollArea,
  Text,
  Tooltip,
  SimpleGrid,
  Box,
  Stack,
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
  {
    name: "Brown",
    color: "#92400E",
  },
];

const HIGHLIGHT_COLORS: BubbleColorMenuItem[] = [
  {
    name: "Default",
    color: "",
  },
  {
    name: "Blue",
    color: "#98d8f2",
  },
  {
    name: "Green",
    color: "#7edb6c",
  },
  {
    name: "Purple",
    color: "#e0d6ed",
  },
  {
    name: "Red",
    color: "#ffc6c2",
  },
  {
    name: "Yellow",
    color: "#faf594",
  },
  {
    name: "Orange",
    color: "#f5c8a9",
  },
  {
    name: "Pink",
    color: "#f5cfe0",
  },
  {
    name: "Gray",
    color: "#dfdfd7",
  },
  {
    name: "Brown",
    color: "#d7c4b7",
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
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }

      const activeColors: Record<string, boolean> = {};
      TEXT_COLORS.forEach(({ color }) => {
        activeColors[`text_${color}`] = ctx.editor.isActive("textStyle", {
          color,
        });
      });
      HIGHLIGHT_COLORS.forEach(({ color }) => {
        activeColors[`highlight_${color}`] = ctx.editor.isActive("highlight", {
          color,
        });
      });

      return activeColors;
    },
  });

  if (!editor || !editorState) {
    return null;
  }

  const activeColorItem = TEXT_COLORS.find(
    ({ color }) => editorState[`text_${color}`],
  );

  const activeHighlightItem = HIGHLIGHT_COLORS.find(
    ({ color }) => editorState[`highlight_${color}`],
  );

  return (
    <Popover width={220} opened={isOpen} withArrow>
      <Popover.Target>
        <Tooltip label={t("Text color")} withArrow>
          <Button
            variant="default"
            radius="0"
            rightSection={<IconChevronDown size={16} />}
            onClick={() => setIsOpen(!isOpen)}
            data-text-color={activeColorItem?.color || ""}
            data-highlight-color={activeHighlightItem?.color || ""}
            className="color-selector-trigger"
            style={{
              height: "34px",
              border: "none",
              fontWeight: 500,
              fontSize: rem(16),
              paddingLeft: rem(8),
              paddingRight: rem(4),
            }}
          >
            A
          </Button>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <ScrollArea.Autosize type="scroll" mah="400">
          <Stack gap="md">
            <Box>
              <Text size="sm" fw={600} mb="xs">
                {t("Text color")}
              </Text>
              <SimpleGrid cols={5} spacing="xs">
                {TEXT_COLORS.map(({ name, color }, index) => (
                  <Tooltip key={index} label={t(name)} withArrow>
                    <Box
                      onClick={() => {
                        if (name === "Default") {
                          editor.commands.unsetColor();
                        } else {
                          editor
                            .chain()
                            .focus()
                            .setColor(color || "")
                            .run();
                        }
                        setIsOpen(false);
                      }}
                      style={{
                        width: rem(28),
                        height: rem(28),
                        borderRadius: rem(6),
                        border: editorState[`text_${color}`]
                          ? "2px solid var(--mantine-color-gray-8)"
                          : "1px solid var(--mantine-color-gray-4)",
                        cursor: "pointer",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: rem(16),
                        fontWeight: 600,
                        color: color || "var(--mantine-color-gray-8)",
                      }}
                    >
                      A
                    </Box>
                  </Tooltip>
                ))}
              </SimpleGrid>
            </Box>

            <Box>
              <Text size="sm" fw={600} mb="xs">
                {t("Highlight color")}
              </Text>
              <SimpleGrid cols={5} spacing="xs">
                {HIGHLIGHT_COLORS.map(({ name, color }, index) => (
                  <Tooltip key={index} label={t(name)} withArrow>
                    <Box
                      onClick={() => {
                        if (name === "Default") {
                          editor.commands.unsetHighlight();
                        } else {
                          editor
                            .chain()
                            .focus()
                            .toggleMark("highlight", {
                              color: color || "",
                              colorName: name.toLowerCase() || "",
                            })
                            .run();
                        }
                        setIsOpen(false);
                      }}
                      style={{
                        width: rem(28),
                        height: rem(28),
                        borderRadius: rem(4),
                        backgroundColor: color || "var(--mantine-color-gray-2)",
                        border: "1px solid var(--mantine-color-gray-4)",
                        cursor: "pointer",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: rem(16),
                        fontWeight: 600,
                        color: "var(--mantine-color-gray-8)",
                      }}
                    >
                      {editorState[`highlight_${color}`] ? (
                        <IconCheck
                          size={16}
                          color="var(--mantine-color-green-7)"
                        />
                      ) : (
                        "A"
                      )}
                    </Box>
                  </Tooltip>
                ))}
              </SimpleGrid>
            </Box>

            <Button
              variant="default"
              fullWidth
              onClick={() => {
                editor.commands.unsetColor();
                editor.commands.unsetHighlight();
                setIsOpen(false);
              }}
            >
              {t("Remove color")}
            </Button>
          </Stack>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
};
