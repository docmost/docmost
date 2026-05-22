import { CommandProps, EmojiMenuItemType } from "./types";
import { buildEmojiIndex, getFrequentlyUsedEmoji, sortFrequentlyUsedEmoji } from "./utils";

const MAX_RESULTS = 5;

const searchEmoji = async (query: string): Promise<EmojiMenuItemType[]> => {
  if (query === "") {
    return sortFrequentlyUsedEmoji(getFrequentlyUsedEmoji());
  }

  const q = query.toLowerCase();
  const index = await buildEmojiIndex();

  return index
    .filter((e) => e.name.includes(q) || e.id.includes(q))
    .slice(0, MAX_RESULTS)
    .map((entry) => ({
      id: entry.id,
      emoji: entry.native,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).insertContent(entry.native + " ").run();
      },
    }));
};

export const getEmojiItems = async ({
  query,
}: {
  query: string;
}): Promise<EmojiMenuItemType[]> => {
  return searchEmoji(query);
};

export default getEmojiItems;
