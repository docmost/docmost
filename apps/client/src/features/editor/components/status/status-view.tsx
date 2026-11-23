import { useState, useRef, useEffect } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Popover, TextInput, Group, Box } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { IconCheck } from "@tabler/icons-react";
import clsx from "clsx";
import classes from "./status.module.css";
import { STATUS_COLORS, type StatusColor } from "@docmost/editor-ext";

const colorClassMap: Record<StatusColor, string> = {
  gray: classes.colorGray,
  blue: classes.colorBlue,
  green: classes.colorGreen,
  yellow: classes.colorYellow,
  red: classes.colorRed,
  purple: classes.colorPurple,
};

export default function StatusView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, editor, getPos } = props;
  const { text, color } = node.attrs as {
    text: string;
    color: StatusColor;
  };

  const [opened, setOpened] = useState(false);
  const [inputValue, setInputValue] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storage = editor.storage?.status;
    if (storage?.autoOpen) {
      storage.autoOpen = false;
      setOpened(true);
    }
  }, []);

  useEffect(() => {
    if (opened) {
      setInputValue(text);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [opened]);

  const debouncedUpdateAttributes = useDebouncedCallback(
    (val: string) => updateAttributes({ text: val }),
    100,
  );

  const handleTextChange = (val: string) => {
    setInputValue(val);
    debouncedUpdateAttributes(val);
  };

  const handleColorChange = (newColor: StatusColor) => {
    updateAttributes({ color: newColor });
  };

  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper style={{ display: "inline" }} data-drag-handle>
      <Popover
        opened={opened}
        onChange={(open) => {
          if (!open && !text) {
            deleteNode();
            return;
          }
          setOpened(open);
        }}
        width={220}
        position="bottom"
        withArrow
        shadow="md"
        trapFocus
      >
        <Popover.Target>
          <span
            className={clsx(
              "status-badge",
              classes.status,
              colorClassMap[color],
            )}
            onClick={() => isEditable && setOpened(true)}
            onKeyDown={(e) => {
              if (isEditable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setOpened(true);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={text || "SET STATUS"}
            aria-haspopup="dialog"
            aria-expanded={opened}
          >
            {text || "SET STATUS"}
          </span>
        </Popover.Target>

        <Popover.Dropdown>
          <TextInput
            ref={inputRef}
            value={inputValue}
            onChange={(e) =>
              handleTextChange(e.currentTarget.value.toUpperCase())
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setOpened(false);
                editor.commands.focus(getPos() + node.nodeSize);
              }
            }}
            placeholder="Status text"
            size="sm"
            mb="xs"
          />

          <Group gap={6} justify="center">
            {STATUS_COLORS.map((name) => (
              <Box
                key={name}
                className={clsx(
                  classes.swatch,
                  color === name && classes.swatchActive,
                )}
                style={{
                  backgroundColor: `var(--mantine-color-${name === "purple" ? "violet" : name}-4)`,
                }}
                onClick={() => handleColorChange(name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleColorChange(name);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={name}
                aria-pressed={color === name}
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
