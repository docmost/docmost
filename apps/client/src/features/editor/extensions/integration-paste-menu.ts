import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export type IntegrationPasteMenuState = {
  pos: number;
  joinBefore: boolean;
  joinAfter: boolean;
} | null;

export const integrationPasteMenuKey = new PluginKey<IntegrationPasteMenuState>(
  "integrationPasteMenu",
);

// Position of a just-pasted integration node, where the "Paste as" menu anchors,
// and which sides of it hold the halves of the paragraph the paste split.
export const IntegrationPasteMenuExtension = Extension.create({
  name: "integrationPasteMenu",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: integrationPasteMenuKey,
        state: {
          init: (): IntegrationPasteMenuState => null,
          apply(tr, prev): IntegrationPasteMenuState {
            const meta = tr.getMeta(integrationPasteMenuKey);
            if (meta !== undefined) return meta;
            if (!prev) return null;
            // Clicking or typing elsewhere dismisses.
            if (tr.selectionSet) return null;
            // Follow-up transactions (unique ids, trailing node) keep the anchor.
            if (tr.docChanged) {
              const pos = tr.mapping.map(prev.pos);
              const node = tr.doc.nodeAt(pos);
              const isIntegrationNode =
                node &&
                (node.type.name === "integrationCard" ||
                  node.type.name === "integrationMention");
              return isIntegrationNode ? { ...prev, pos } : null;
            }
            return prev;
          },
        },
      }),
    ];
  },
});
