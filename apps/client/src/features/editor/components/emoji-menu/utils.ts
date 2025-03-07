import { CommandProps } from "./types";
import { getEmojiDataFromNative } from "emoji-mart";
import { EmojiMartFrequentlyType, EmojiMenuItemType } from "./types";

export const GRID_COLUMNS = 10;

export const LOCAL_STORAGE_FREQUENT_KEY = "emoji-mart.frequently";

export const DEFAULT_FREQUENTLY_USED_EMOJI_MART = `{
    "+1": 10,
    "grinning": 9,
    "kissing_heart": 8,
    "heart_eyes": 7,
    "laughing": 6,
    "stuck_out_tongue_winking_eye": 5,
    "sweat_smile": 4,
    "joy": 3,
    "scream": 2,
    "rocket": 1
}`;

export const incrementEmojiUsage = (emojiId: string) => {
  const frequentlyUsedEmoji =
    JSON.parse(localStorage.getItem(LOCAL_STORAGE_FREQUENT_KEY) || DEFAULT_FREQUENTLY_USED_EMOJI_MART);
  frequentlyUsedEmoji[emojiId]
    ? (frequentlyUsedEmoji[emojiId] += 1)
    : (frequentlyUsedEmoji[emojiId] = 1);
  localStorage.setItem(
    LOCAL_STORAGE_FREQUENT_KEY,
    JSON.stringify(frequentlyUsedEmoji)
  );
};

export const sortFrequentlyUsedEmoji = async (
  frequentlyUsedEmoji: EmojiMartFrequentlyType
): Promise<EmojiMenuItemType[]> => {
  const data = await Promise.all(
    Object.entries(frequentlyUsedEmoji).map(
      async ([id, count]): Promise<EmojiMenuItemType> => ({
        id,
        count,
        emoji: (await getEmojiDataFromNative(id))?.native,
        command: async ({ editor, range }: CommandProps) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent((await getEmojiDataFromNative(id))?.native + " ")
            .run();
        },
      })
    )
  );
  return data.sort((a, b) => b.count - a.count);
};

export const getFrequentlyUsedEmoji = () => {
  return JSON.parse(localStorage.getItem(LOCAL_STORAGE_FREQUENT_KEY) || DEFAULT_FREQUENTLY_USED_EMOJI_MART);
}
