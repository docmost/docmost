import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export type BasePasteMenuState = { pos: number } | null;

export const basePasteMenuKey = new PluginKey<BasePasteMenuState>(
  "basePasteMenu",
);

// Position of a just-pasted base mention, where the "Paste as" menu offers its embed.
export const BasePasteMenuExtension = Extension.create({
  name: "basePasteMenu",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: basePasteMenuKey,
        state: {
          init: (): BasePasteMenuState => null,
          apply(tr, prev): BasePasteMenuState {
            const meta = tr.getMeta(basePasteMenuKey);
            if (meta !== undefined) return meta;
            if (!prev) return null;
            // Clicking or typing elsewhere dismisses.
            if (tr.selectionSet) return null;
            // Follow-up transactions (unique ids, trailing node) keep the anchor.
            if (tr.docChanged) {
              const pos = tr.mapping.map(prev.pos);
              return tr.doc.nodeAt(pos)?.type.name === "mention"
                ? { pos }
                : null;
            }
            return prev;
          },
        },
      }),
    ];
  },
});
