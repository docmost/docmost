import { Group, Loader, Paper, ScrollArea, Text, UnstyledButton } from "@mantine/core";
import { EmojiMenuItemType } from "./types";
import clsx from "clsx";
import classes from "./emoji-menu.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { incrementEmojiUsage } from "./utils";

const EmojiList = ({
  items,
  isLoading,
  command,
}: {
  items: EmojiMenuItemType[];
  isLoading: boolean;
  command: any;
  editor: any;
  range: any;
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
        incrementEmojiUsage(item.id);
      }
    },
    [command, items],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < items.length ? prev + 1 : prev));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));
        return true;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectItem(selectedIndex);
        return true;
      }
      return false;
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [items, selectedIndex, selectItem]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    viewportRef.current
      ?.querySelector(`[data-item-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!items.length && !isLoading) return null;

  return (
    <Paper
      id="emoji-command"
      p="0"
      shadow="md"
      withBorder
      style={{ minWidth: 200 }}
      role="listbox"
      aria-label="Emoji results"
      aria-activedescendant={
        items.length > 0 ? `emoji-command-option-${selectedIndex}` : undefined
      }
    >
      {isLoading && <Loader m="xs" color="blue" type="dots" />}
      {items.length > 0 && (
        <ScrollArea.Autosize viewportRef={viewportRef} mah={300} scrollbarSize={6}>
          <div style={{ padding: "4px" }}>
            {items.map((item, index) => (
              <UnstyledButton
                data-item-index={index}
                id={`emoji-command-option-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                key={item.id}
                w="100%"
                className={clsx(classes.menuItem, {
                  [classes.selectedItem]: index === selectedIndex,
                })}
                onClick={() => selectItem(index)}
              >
                <Group gap="sm" wrap="nowrap">
                  <Text size="xl" style={{ lineHeight: 1, minWidth: 28 }}>
                    {item.emoji}
                  </Text>
                  <Text size="sm" c="dimmed" ff="monospace">
                    :{item.id}:
                  </Text>
                </Group>
              </UnstyledButton>
            ))}
          </div>
        </ScrollArea.Autosize>
      )}
    </Paper>
  );
};

export default EmojiList;
