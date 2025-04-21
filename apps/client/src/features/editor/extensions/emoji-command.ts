import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import getEmojiItems from "../components/emoji-menu/emoji-items";
import renderEmojiItems from "../components/emoji-menu/render-emoji-items";
export const emojiMenuPluginKey = new PluginKey("emoji-command");

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
