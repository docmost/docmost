import {
  ActionIcon,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Text,
} from "@mantine/core";
import { EmojiMenuItemType } from "./types";
import clsx from "clsx";
import classes from "./emoji-menu.module.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { GRID_COLUMNS, incrementEmojiUsage } from "./utils";

const EmojiList = ({
  items,
  isLoading,
  command,
  editor,
  range,
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
    [command, items]
  );

  useEffect(() => {
    const navigationKeys = [
      "ArrowRight",
      "ArrowLeft",
      "ArrowUp",
      "ArrowDown",
      "Enter",
    ];
    const onKeyDown = (e: KeyboardEvent) => {
      if (navigationKeys.includes(e.key)) {
        e.preventDefault();

        if (e.key === "ArrowRight") {
          setSelectedIndex(
            selectedIndex + 1 < items.length ? selectedIndex + 1 : selectedIndex
          );
          return true;
        }

        if (e.key === "ArrowLeft") {
          setSelectedIndex(
            selectedIndex - 1 >= 0 ? selectedIndex - 1 : selectedIndex
          );
          return true;
        }

        if (e.key === "ArrowUp") {
          setSelectedIndex(
            selectedIndex - GRID_COLUMNS >= 0
              ? selectedIndex - GRID_COLUMNS
              : selectedIndex
          );
          return true;
        }

        if (e.key === "ArrowDown") {
          setSelectedIndex(
            selectedIndex + GRID_COLUMNS < items.length
              ? selectedIndex + GRID_COLUMNS
              : selectedIndex
          );
          return true;
        }

        if (e.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [items, selectedIndex, setSelectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    viewportRef.current
      ?.querySelector(`[data-item-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return items.length > 0 || isLoading ? (
    <Paper id="emoji-command" p="0" shadow="md" withBorder>
      {isLoading && <Loader m="xs" color="blue" type="dots" />}
      {items.length > 0 && (
        <ScrollArea.Autosize
          viewportRef={viewportRef}
          mah={250}
          scrollbarSize={8}
          pr="5"
        >
          <SimpleGrid cols={GRID_COLUMNS} p="xs" spacing="xs">
            {items.map((item, index: number) => (
              <ActionIcon
                data-item-index={index}
                variant="transparent"
                key={item.id}
                className={clsx(classes.menuBtn, {
                  [classes.selectedItem]: index === selectedIndex,
                })}
                onClick={() => selectItem(index)}
              >
                <Text size="xl">{item.emoji}</Text>
              </ActionIcon>
            ))}
          </SimpleGrid>
        </ScrollArea.Autosize>
      )}
    </Paper>
  ) : null;
};

export default EmojiList;
