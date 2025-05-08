import { CommandProps, EmojiMenuItemType } from "./types";
import { SearchIndex } from "emoji-mart";
import { getFrequentlyUsedEmoji, sortFrequentlyUsedEmoji } from "./utils";

const searchEmoji = async (value: string): Promise<EmojiMenuItemType[]> => {
  if (value === "") {
    const frequentlyUsedEmoji = getFrequentlyUsedEmoji();
    return sortFrequentlyUsedEmoji(frequentlyUsedEmoji);
  }

  const emojis = await SearchIndex.search(value);
  const results = emojis.map((emoji: any) => {
    return {
      id: emoji.id,
      emoji: emoji.skins[0].native,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(emoji.skins[0].native + " ")
          .run();
      },
    };
  });

  return results;
};

export const getEmojiItems = async ({
  query,
}: {
  query: string;
}): Promise<EmojiMenuItemType[]> => {
  return searchEmoji(query);
};

export default getEmojiItems;
