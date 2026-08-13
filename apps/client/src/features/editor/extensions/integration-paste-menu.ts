import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export type IntegrationPasteMenuState = { pos: number } | null;

export const integrationPasteMenuKey = new PluginKey<IntegrationPasteMenuState>(
  "integrationPasteMenu",
);

// Holds the position of a just-pasted integration node so the "Paste as"
// menu can anchor to it. Any other edit or selection change dismisses it.
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
            // Structural follow-ups (unique-id assignment, trailing node)
            // keep the menu anchored: remap and re-validate the position.
            if (tr.docChanged) {
              const pos = tr.mapping.map(prev.pos);
              const node = tr.doc.nodeAt(pos);
              const isIntegrationNode =
                node &&
                (node.type.name === "integrationLink" ||
                  node.type.name === "integrationMention");
              return isIntegrationNode ? { pos } : null;
            }
            return prev;
          },
        },
      }),
    ];
  },
});
