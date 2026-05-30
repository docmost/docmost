import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const CleanStyles = Extension.create({
  name: "cleanStyles",
  priority: 80,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("cleanStyles"),
        props: {
          transformPastedHTML(html) {
            return html.replace(/\s+style="[^"]*"/gi, "");
          },
        },
      }),
    ];
  },
});
