import { useState, useRef, useEffect } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Popover, TextInput, Group, Box } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { IconCheck } from "@tabler/icons-react";
import clsx from "clsx";
import classes from "./inline-status.module.css";
import type { InlineStatusColor } from "@docmost/editor-ext";

const STATUS_COLORS: { name: InlineStatusColor; bg: string }[] = [
  { name: "gray", bg: "var(--mantine-color-gray-4)" },
  { name: "blue", bg: "var(--mantine-color-blue-4)" },
  { name: "green", bg: "var(--mantine-color-green-4)" },
  { name: "yellow", bg: "var(--mantine-color-yellow-4)" },
  { name: "red", bg: "var(--mantine-color-red-4)" },
  { name: "purple", bg: "var(--mantine-color-violet-4)" },
];

const colorClassMap: Record<InlineStatusColor, string> = {
  gray: classes.colorGray,
  blue: classes.colorBlue,
  green: classes.colorGreen,
  yellow: classes.colorYellow,
  red: classes.colorRed,
  purple: classes.colorPurple,
};

export default function InlineStatusView(props: NodeViewProps) {
  const { node, updateAttributes, editor } = props;
  const { text, color } = node.attrs as {
    text: string;
    color: InlineStatusColor;
  };

  const [opened, setOpened] = useState(false);
  const [inputValue, setInputValue] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (opened) {
      setInputValue(text);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [opened]);

  const debouncedUpdateAttributes = useDebouncedCallback(
    (val: string) => updateAttributes({ text: val }),
    300,
  );

  const handleTextChange = (val: string) => {
    setInputValue(val);
    debouncedUpdateAttributes(val);
  };

  const handleColorChange = (newColor: InlineStatusColor) => {
    updateAttributes({ color: newColor });
  };

  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper style={{ display: "inline" }} data-drag-handle>
      <Popover
        opened={opened}
        onChange={setOpened}
        width={220}
        position="bottom"
        withArrow
        shadow="md"
        trapFocus
      >
        <Popover.Target>
          <span
            className={clsx("inline-status", classes.status, colorClassMap[color])}
            onClick={() => isEditable && setOpened(true)}
            role="button"
            tabIndex={0}
          >
            {text || "STATUS"}
          </span>
        </Popover.Target>

        <Popover.Dropdown>
          <TextInput
            ref={inputRef}
            value={inputValue}
            onChange={(e) => handleTextChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setOpened(false);
              }
            }}
            placeholder="Status text"
            size="sm"
            mb="xs"
          />

          <Group gap={6}>
            {STATUS_COLORS.map(({ name, bg }) => (
              <Box
                key={name}
                className={clsx(
                  classes.swatch,
                  color === name && classes.swatchActive,
                )}
                style={{ backgroundColor: bg }}
                onClick={() => handleColorChange(name)}
              >
                {color === name && <IconCheck size={14} />}
              </Box>
            ))}
          </Group>
        </Popover.Dropdown>
      </Popover>
    </NodeViewWrapper>
  );
}
