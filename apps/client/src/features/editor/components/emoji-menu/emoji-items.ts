import { CommandProps, EmojiMenuItemType } from "./types";
import { SearchIndex } from "emoji-mart";
import { getFrequentlyUsedEmoji, sortFrequentlyUsedEmoji } from "./utils";

const MAX_EMOJI_RESULTS = 8;

const searchEmoji = async (value: string): Promise<EmojiMenuItemType[]> => {
  if (value === "") {
    const frequentlyUsedEmoji = getFrequentlyUsedEmoji();
    return sortFrequentlyUsedEmoji(frequentlyUsedEmoji);
  }

  const emojis = await SearchIndex.search(value);
  return emojis.slice(0, MAX_EMOJI_RESULTS).map((emoji: any) => ({
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
