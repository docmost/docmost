// adapted from: https://github.com/aguingand/tiptap-markdown/blob/main/src/extensions/tiptap/clipboard.js - MIT
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DOMParser } from "@tiptap/pm/model";
import { find } from "linkifyjs";
import { markdownToHtml } from "@docmost/editor-ext";

export const MarkdownClipboard = Extension.create({
  name: "markdownClipboard",
  priority: 101,

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
          handlePaste: (view, event, slice) => {
            if (!event.clipboardData) {
              return false;
            }

            if (this.editor.isActive("codeBlock")) {
              return false;
            }

            const text = event.clipboardData.getData("text/plain");
            const vscode = event.clipboardData.getData("vscode-editor-data");
            const vscodeData = vscode ? JSON.parse(vscode) : undefined;
            const language = vscodeData?.mode;

            if (language !== "markdown") {
              return false;
            }

            const { tr } = view.state;
            const { from, to } = view.state.selection;

            const html = markdownToHtml(text);

            const contentNodes = DOMParser.fromSchema(
              this.editor.schema,
            ).parseSlice(elementFromString(html), {
              preserveWhitespace: true,
            });

            tr.replaceRange(from, to, contentNodes);
            tr.setMeta('paste', true)
            view.dispatch(tr);
            return true;
          },
          clipboardTextParser: (text, context, plainText) => {
            const link = find(text, {
              defaultProtocol: "http",
            }).find((item) => item.isLink && item.value === text);

            if (plainText || !this.options.transformPastedText || link) {
              // don't parse plaintext link to allow link paste handler to work
              // pasting with shift key prevents formatting
              return null;
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
