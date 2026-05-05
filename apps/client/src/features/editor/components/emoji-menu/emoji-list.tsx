import { Loader, Paper, ScrollArea, Text, UnstyledButton } from "@mantine/core";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmojiMenuItemType } from "./types";
import {
  EmojiCategory,
  EmojiIndexEntry,
  getEmojiCategories,
  incrementEmojiUsage,
} from "./utils";
import classes from "./emoji-menu.module.css";

const COLS = 8;

const CAT_ICONS: Record<string, string> = {
  people:   "😀",
  nature:   "🌿",
  foods:    "🍕",
  activity: "🎮",
  places:   "🗺️",
  objects:  "🔧",
  symbols:  "💯",
  flags:    "🚩",
};

function EmojiList({
  items,
  isLoading,
  command,
  editor,
  range,
  query = "",
}: {
  items: EmojiMenuItemType[];
  isLoading: boolean;
  command: (item: EmojiMenuItemType) => void;
  editor: any;
  range: any;
  query?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [cats, setCats] = useState<EmojiCategory[]>([]);
  const [activeCat, setActiveCat] = useState("");
  const listViewport = useRef<HTMLDivElement>(null);
  const gridViewport = useRef<HTMLDivElement>(null);

  const searching = query.length > 0;
  const gridItems = cats.find((c) => c.id === activeCat)?.emojis ?? [];

  useEffect(() => {
    getEmojiCategories().then((data) => {
      setCats(data);
      setActiveCat((prev) => prev || data[0]?.id || "");
    });
  }, []);

  useEffect(() => { setIdx(0); }, [query, activeCat]);

  useEffect(() => {
    const vp = searching ? listViewport.current : gridViewport.current;
    vp?.querySelector<HTMLElement>(`[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx, searching]);

  const pickSearchItem = useCallback(
    (i: number) => {
      const item = items[i];
      if (!item) return;
      command(item);
      incrementEmojiUsage(item.id);
    },
    [command, items],
  );

  const pickGridItem = useCallback(
    (entry: EmojiIndexEntry) => {
      editor.chain().focus().deleteRange(range).insertContent(entry.native + " ").run();
      incrementEmojiUsage(entry.id);
    },
    [editor, range],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (searching) {
        if      (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
        else if (e.key === "ArrowUp")   { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
        else if (e.key === "Enter")     { e.preventDefault(); pickSearchItem(idx); }
      } else {
        const total = gridItems.length;
        if      (e.key === "ArrowRight") { e.preventDefault(); setIdx((i) => Math.min(i + 1, total - 1)); }
        else if (e.key === "ArrowLeft")  { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
        else if (e.key === "ArrowDown")  { e.preventDefault(); setIdx((i) => Math.min(i + COLS, total - 1)); }
        else if (e.key === "ArrowUp")    { e.preventDefault(); setIdx((i) => Math.max(i - COLS, 0)); }
        else if (e.key === "Enter")      { e.preventDefault(); if (gridItems[idx]) pickGridItem(gridItems[idx]); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searching, items, idx, gridItems, pickSearchItem, pickGridItem]);

  return (
    <Paper
      id="emoji-command"
      p={0}
      shadow="md"
      withBorder
      style={{ width: 280 }}
      role="listbox"
      aria-label="Emoji picker"
    >
      {searching ? (
        <>
          {isLoading && <Loader m="xs" size="xs" color="blue" type="dots" />}
          <ScrollArea.Autosize mah={260} scrollbarSize={6} viewportRef={listViewport}>
            <div style={{ padding: 4 }}>
              {items.length === 0 && !isLoading ? (
                <Text size="sm" c="dimmed" p="xs">No results</Text>
              ) : items.map((item, i) => (
                <UnstyledButton
                  key={item.id}
                  data-i={i}
                  w="100%"
                  className={clsx(classes.row, { [classes.active]: i === idx })}
                  onClick={() => pickSearchItem(i)}
                  onMouseEnter={() => setIdx(i)}
                  role="option"
                  aria-selected={i === idx}
                >
                  <span style={{ fontSize: 20, lineHeight: 1, minWidth: 26 }}>{item.emoji}</span>
                  <Text size="sm" c="dimmed" ff="monospace" span>:{item.id}:</Text>
                </UnstyledButton>
              ))}
            </div>
          </ScrollArea.Autosize>
        </>
      ) : (
        <>
          <div className={classes.catBar} role="tablist">
            {cats.map((c) => (
              <button
                key={c.id}
                title={c.id}
                role="tab"
                aria-selected={c.id === activeCat}
                className={clsx(classes.catTab, { [classes.catTabActive]: c.id === activeCat })}
                onClick={() => setActiveCat(c.id)}
              >
                {CAT_ICONS[c.id] ?? "🔣"}
              </button>
            ))}
          </div>
          <ScrollArea.Autosize mah={220} scrollbarSize={6} viewportRef={gridViewport}>
            <div className={classes.grid} style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
              {gridItems.map((entry, i) => (
                <button
                  key={entry.id}
                  data-i={i}
                  title={`:${entry.id}:`}
                  className={clsx(classes.emojiBtn, { [classes.active]: i === idx })}
                  onClick={() => pickGridItem(entry)}
                  onMouseEnter={() => setIdx(i)}
                >
                  {entry.native}
                </button>
              ))}
            </div>
          </ScrollArea.Autosize>
        </>
      )}
    </Paper>
  );
}

export default EmojiList;
