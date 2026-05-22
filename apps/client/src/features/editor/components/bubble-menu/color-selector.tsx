import React, { Dispatch, FC, SetStateAction } from "react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import {
  Button,
  Popover,
  rem,
  Text,
  Tooltip,
  SimpleGrid,
  Box,
  Stack,
} from "@mantine/core";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import classes from "./bubble-menu.module.css";

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

const COLOR_GRID_COLS = 5;

function focusSwatch(grid: "text" | "highlight", index: number) {
  const el = document.querySelector<HTMLElement>(
    `[data-color-grid="${grid}"][data-color-index="${index}"]`,
  );
  el?.focus();
}

function handleColorKeyNav(
  e: React.KeyboardEvent<HTMLDivElement>,
  index: number,
  grid: "text" | "highlight",
) {
  const cols = COLOR_GRID_COLS;
  const total =
    grid === "text" ? TEXT_COLORS.length : HIGHLIGHT_COLORS.length;
  const col = index % cols;

  if (e.key === "ArrowRight") {
    e.preventDefault();
    if (index < total - 1) focusSwatch(grid, index + 1);
    return;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    if (index > 0) focusSwatch(grid, index - 1);
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = index + cols;
    if (next < total) {
      focusSwatch(grid, next);
    } else if (grid === "text") {
      focusSwatch("highlight", Math.min(col, HIGHLIGHT_COLORS.length - 1));
    } else if (grid === "highlight") {
      document
        .querySelector<HTMLElement>('[data-color-grid="remove"]')
        ?.focus();
    }
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = index - cols;
    if (prev >= 0) {
      focusSwatch(grid, prev);
    } else if (grid === "highlight") {
      const lastRowStart =
        Math.floor((TEXT_COLORS.length - 1) / cols) * cols;
      focusSwatch("text", Math.min(lastRowStart + col, TEXT_COLORS.length - 1));
    }
    return;
  }
}

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
    <Popover
      width={220}
      opened={isOpen}
      onChange={setIsOpen}
      trapFocus
      withArrow
    >
      <Popover.Target>
        <Tooltip label={t("Text color")} withArrow>
          <Button
            variant="default"
            radius="0"
            rightSection={<IconChevronDown size={16} />}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsOpen(!isOpen)}
            data-text-color={activeColorItem?.color || ""}
            data-highlight-color={activeHighlightItem?.color || ""}
            className={clsx(["color-selector-trigger", classes.buttonRoot])}
            style={{
              fontWeight: 500,
              fontSize: rem(16),
            }}
            aria-label={t("Text color")}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
          >
            A
          </Button>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown onMouseDown={(e) => e.preventDefault()}>
        <Stack gap="md" p="2px">
            <Box>
              <Text size="sm" fw={600} mb="xs">
                {t("Text color")}
              </Text>
              <SimpleGrid cols={5} spacing="xs">
                {TEXT_COLORS.map(({ name, color }, index) => {
                  const applyTextColor = () => {
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
                  };
                  return (
                  <Tooltip key={index} label={t(name)} withArrow>
                    <Box
                      role="button"
                      tabIndex={0}
                      data-autofocus={index === 0 ? true : undefined}
                      data-color-grid="text"
                      data-color-index={index}
                      className={classes.colorSwatch}
                      aria-label={t(name)}
                      aria-pressed={!!editorState[`text_${color}`]}
                      onClick={applyTextColor}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          applyTextColor();
                          return;
                        }
                        handleColorKeyNav(e, index, "text");
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
                  );
                })}
              </SimpleGrid>
            </Box>

            <Box>
              <Text size="sm" fw={600} mb="xs">
                {t("Highlight color")}
              </Text>
              <SimpleGrid cols={5} spacing="xs">
                {HIGHLIGHT_COLORS.map(({ name, color }, index) => {
                  const applyHighlight = () => {
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
                  };
                  return (
                  <Tooltip key={index} label={t(name)} withArrow>
                    <Box
                      role="button"
                      tabIndex={0}
                      data-color-grid="highlight"
                      data-color-index={index}
                      className={classes.colorSwatch}
                      aria-label={t(name)}
                      aria-pressed={!!editorState[`highlight_${color}`]}
                      onClick={applyHighlight}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          applyHighlight();
                          return;
                        }
                        handleColorKeyNav(e, index, "highlight");
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
                  );
                })}
              </SimpleGrid>
            </Box>

            <Button
              variant="default"
              fullWidth
              data-color-grid="remove"
              className={classes.removeColor}
              onClick={() => {
                editor.commands.unsetColor();
                editor.commands.unsetHighlight();
                setIsOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  const lastRowStart =
                    Math.floor(
                      (HIGHLIGHT_COLORS.length - 1) / COLOR_GRID_COLS,
                    ) * COLOR_GRID_COLS;
                  focusSwatch("highlight", lastRowStart);
                }
              }}
            >
              {t("Remove color")}
            </Button>
          </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};
