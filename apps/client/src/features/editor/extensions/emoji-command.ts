import { Extension } from "@tiptap/core";
import { PluginKey, Plugin } from "@tiptap/pm/state";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import getEmojiItems from "../components/emoji-menu/emoji-items";
import renderEmojiItems from "../components/emoji-menu/render-emoji-items";
import { init, Data } from "emoji-mart";
import { incrementEmojiUsage } from "../components/emoji-menu/utils";

export const emojiMenuPluginKey = new PluginKey("emoji-command");

const getEmoji = (shortcode: string): string | null => {
  init({
    data: async () => (await import("@emoji-mart/data")).default,
  });

  if (Data) {
    const name = shortcode.replace(/:/g, "");
    const emojiData = Data.emojis[name];
    if (emojiData) {
      incrementEmojiUsage(emojiData.id);
      return emojiData.skins[0].native;
    }
  }
  return null;
};

const Command = Extension.create({
  name: "emoji-command",

  addOptions() {
    return {
      suggestion: {
        char: ":",
        command: ({ editor, range, props }) => {
          props.command({ editor, range, props });
        },
      } as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: emojiMenuPluginKey,
        ...this.options.suggestion,
        editor: this.editor,
      }),
      new Plugin({
        appendTransaction(transactions, oldState, newState) {
          let tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (!node.isText) return;

            const text = node.text || "";
            const regex = /:\w+:/g;
            let match: RegExpExecArray;
            let offset = 0;

            while ((match = regex.exec(text)) !== null) {
              const emoji = getEmoji(match[0]);
              if (emoji) {
                const start = pos + match.index + offset;
                const end = start + match[0].length;

                tr = tr.replaceWith(start, end, newState.schema.text(emoji));
                offset += emoji.length - match[0].length;
                modified = true;
              }
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});

const EmojiCommand = Command.configure({
  suggestion: {
    items: getEmojiItems,
    render: renderEmojiItems,
  },
});

export default EmojiCommand;
