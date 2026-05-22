import { CommandProps, EmojiMartFrequentlyType, EmojiMenuItemType } from "./types";

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

export type EmojiIndexEntry = { id: string; name: string; native: string };

let _emojiIndex: EmojiIndexEntry[] | null = null;

export const buildEmojiIndex = async (): Promise<EmojiIndexEntry[]> => {
  if (_emojiIndex) return _emojiIndex;
  const { default: data } = await import('@slidoapp/emoji-mart-data');
  _emojiIndex = (Object.values((data as any).emojis) as any[])
    .filter((e) => e.id && e.name && e.skins?.[0]?.native)
    .map((e) => ({
      id: e.id as string,
      name: (e.name as string).toLowerCase(),
      native: e.skins[0].native as string,
    }));
  return _emojiIndex;
};

export const incrementEmojiUsage = (emojiId: string) => {
  const stored = JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_FREQUENT_KEY) || DEFAULT_FREQUENTLY_USED_EMOJI_MART,
  );
  stored[emojiId] = (stored[emojiId] ?? 0) + 1;
  localStorage.setItem(LOCAL_STORAGE_FREQUENT_KEY, JSON.stringify(stored));
};

export const sortFrequentlyUsedEmoji = async (
  frequentlyUsedEmoji: EmojiMartFrequentlyType,
): Promise<EmojiMenuItemType[]> => {
  const index = await buildEmojiIndex();
  const results: EmojiMenuItemType[] = Object.entries(frequentlyUsedEmoji)
    .map(([id, count]): EmojiMenuItemType | null => {
      const entry = index.find((e) => e.id === id);
      if (!entry) return null;
      return {
        id,
        count,
        emoji: entry.native,
        command: ({ editor, range }: CommandProps) => {
          editor.chain().focus().deleteRange(range).insertContent(entry.native + " ").run();
        },
      };
    })
    .filter((e): e is EmojiMenuItemType => e !== null);
  return results.sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 5);
};

export const getFrequentlyUsedEmoji = (): EmojiMartFrequentlyType => {
  return JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_FREQUENT_KEY) || DEFAULT_FREQUENTLY_USED_EMOJI_MART,
  );
};

export type EmojiCategory = { id: string; emojis: EmojiIndexEntry[] };

let _cats: EmojiCategory[] | null = null;

export const getEmojiCategories = async (): Promise<EmojiCategory[]> => {
  if (_cats) return _cats;
  const [{ default: data }, index] = await Promise.all([
    import("@slidoapp/emoji-mart-data"),
    buildEmojiIndex(),
  ]);
  const byId = new Map(index.map((e) => [e.id, e]));
  _cats = ((data as any).categories as { id: string; emojis: string[] }[])
    .map((cat) => ({
      id: cat.id,
      emojis: cat.emojis
        .map((id) => byId.get(id))
        .filter((e): e is EmojiIndexEntry => !!e),
    }))
    .filter((c) => c.emojis.length > 0);
  return _cats;
};
