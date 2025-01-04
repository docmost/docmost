// adapted from: https://github.com/aguingand/tiptap-markdown/blob/main/src/extensions/tiptap/clipboard.js - MIT
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DOMParser } from "@tiptap/pm/model";
import { markdownToHtml } from "./utils/marked.utils";

export const MarkdownClipboard = Extension.create({
  name: "markdownClipboard",
  addOptions() {
    return {
      transformPastedText: false,
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markdownClipboard"),
        props: {
          clipboardTextParser: (text, context, plainText) => {
            if (plainText || !this.options.transformPastedText) {
              return null; // pasting with shift key prevents formatting
            }
            const parsed = markdownToHtml(text);
            return DOMParser.fromSchema(this.editor.schema).parseSlice(
              elementFromString(parsed),
              {
                preserveWhitespace: true,
                context,
              },
            );
          },
        },
      }),
    ];
  },
});

function elementFromString(value) {
  // add a wrapper to preserve leading and trailing whitespace
  const wrappedValue = `<body>${value}</body>`;

  return new window.DOMParser().parseFromString(wrappedValue, "text/html").body;
}
