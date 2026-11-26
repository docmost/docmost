import { Extension, getMarkRange } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ySyncPluginKey } from "@tiptap/y-tiptap";

export type LinkPasteMenuState = {
  from: number;
  to: number;
  url: string;
} | null;

export const linkPasteMenuKey = new PluginKey<LinkPasteMenuState>(
  "linkPasteMenu",
);

// Range of a just-pasted plain link, where the "Paste as" menu anchors.
export const LinkPasteMenuExtension = Extension.create({
  name: "linkPasteMenu",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: linkPasteMenuKey,
        state: {
          init: (): LinkPasteMenuState => null,
          apply(tr, prev): LinkPasteMenuState {
            const meta = tr.getMeta(linkPasteMenuKey);
            if (meta !== undefined) return meta;
            const isRemote = tr.getMeta(ySyncPluginKey)?.isChangeOrigin;
            // y-sync restores the local selection on every remote change, so only a local one dismisses.
            if (!prev || (tr.selectionSet && !isRemote)) return null;
            if (tr.docChanged) {
              const isFollowUp = tr.getMeta("appendedTransaction") || isRemote;
              // Typing next to the link doesn't move the selection, so any other change dismisses.
              if (!isFollowUp) return null;

              const from = tr.mapping.map(prev.from, 1);
              const to = tr.mapping.map(prev.to, -1);
              const range = getMarkRange(
                tr.doc.resolve(from),
                tr.doc.type.schema.marks.link,
                { href: prev.url },
              );
              return range && range.from === from && range.to === to
                ? { ...prev, from, to }
                : null;
            }
            return prev;
          },
        },
      }),
    ];
  },
});
